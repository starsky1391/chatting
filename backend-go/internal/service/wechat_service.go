package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"chat-backend/internal/config"
	"chat-backend/internal/model"
	"chat-backend/internal/repository"

	"gorm.io/gorm"
)

type WechatService struct {
	userRepo    *repository.UserRepository
	bindingRepo *repository.WechatBindingRepository
	cfg         *config.Config
}

func NewWechatService(userRepo *repository.UserRepository, bindingRepo *repository.WechatBindingRepository, cfg *config.Config) *WechatService {
	return &WechatService{
		userRepo:    userRepo,
		bindingRepo: bindingRepo,
		cfg:         cfg,
	}
}

type WechatLoginInput struct {
	Code string `json:"code" binding:"required"`
}

type WechatLoginResponse struct {
	AccessToken string             `json:"accessToken"`
	User        model.UserResponse `json:"user"`
	IsNew       bool               `json:"isNew"`
}

type WechatSessionResponse struct {
	OpenID     string `json:"openid"`
	SessionKey string `json:"session_key"`
	UnionID    string `json:"unionid"`
	ErrCode    int    `json:"errcode"`
	ErrMsg     string `json:"errmsg"`
}

// Login 处理微信小程序登录
func (s *WechatService) Login(input WechatLoginInput) (*WechatLoginResponse, error) {
	// 1. 调用微信 code2Session 接口
	sessionResp, err := s.getWechatSession(input.Code)
	if err != nil {
		return nil, fmt.Errorf("微信登录失败: %w", err)
	}

	if sessionResp.ErrCode != 0 {
		return nil, fmt.Errorf("微信登录失败: %s", sessionResp.ErrMsg)
	}

	// 2. 查找或创建用户
	user, isNew, err := s.findOrCreateUserByOpenID(sessionResp.OpenID)
	if err != nil {
		return nil, fmt.Errorf("用户创建失败: %w", err)
	}

	// 3. 返回响应
	return &WechatLoginResponse{
		User:  model.ToUserResponse(*user),
		IsNew: isNew,
	}, nil
}

// getWechatSession 调用微信 code2Session 接口
func (s *WechatService) getWechatSession(code string) (*WechatSessionResponse, error) {
	url := fmt.Sprintf(
		"https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code",
		s.cfg.Wechat.AppID,
		s.cfg.Wechat.AppSecret,
		code,
	)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var sessionResp WechatSessionResponse
	if err := json.NewDecoder(resp.Body).Decode(&sessionResp); err != nil {
		return nil, err
	}

	return &sessionResp, nil
}

// findOrCreateUserByOpenID 根据 OpenID 查找或创建用户
func (s *WechatService) findOrCreateUserByOpenID(openID string) (*model.User, bool, error) {
	// 查找 wechat_binding
	binding, err := s.bindingRepo.FindByOpenID(openID)
	if err == nil && binding.ID != 0 {
		// 已存在，获取用户
		user, err := s.userRepo.FindByID(binding.UserID)
		if err != nil {
			return nil, false, err
		}
		return user, false, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, err
	}

	// 不存在，创建新用户
	user := &model.User{
		Username: fmt.Sprintf("用户%s", openID[:8]),
		Avatar:   "默",
		Role:     "member",
		IsOnline: true,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, false, err
	}

	// 创建绑定关系
	binding = &model.WechatBinding{
		UserID: user.ID,
		OpenID: openID,
	}

	if err := s.bindingRepo.Create(binding); err != nil {
		return nil, false, err
	}

	return user, true, nil
}