package repository

import (
	"chat-backend/internal/model"

	"gorm.io/gorm"
)

type GroupRoleRepository struct {
	db *gorm.DB
}

func NewGroupRoleRepository(db *gorm.DB) *GroupRoleRepository {
	return &GroupRoleRepository{db: db}
}

func (r *GroupRoleRepository) Create(role *model.GroupRole) error {
	return r.db.Create(role).Error
}

func (r *GroupRoleRepository) FindByID(id uint) (*model.GroupRole, error) {
	var role model.GroupRole
	err := r.db.First(&role, id).Error
	return &role, err
}

func (r *GroupRoleRepository) FindByGroupID(groupID uint) ([]model.GroupRole, error) {
	var roles []model.GroupRole
	err := r.db.Where("group_id = ?", groupID).Order("position asc, id asc").Find(&roles).Error
	return roles, err
}

func (r *GroupRoleRepository) FindDefaultByGroupID(groupID uint) (*model.GroupRole, error) {
	var role model.GroupRole
	err := r.db.Where("group_id = ? AND is_default = ?", groupID, true).First(&role).Error
	return &role, err
}

func (r *GroupRoleRepository) Exists(groupID uint, name string) bool {
	var count int64
	r.db.Model(&model.GroupRole{}).Where("group_id = ? AND name = ?", groupID, name).Count(&count)
	return count > 0
}

func (r *GroupRoleRepository) Update(role *model.GroupRole) error {
	return r.db.Save(role).Error
}

func (r *GroupRoleRepository) Delete(id uint) error {
	return r.db.Delete(&model.GroupRole{}, id).Error
}

func (r *GroupRoleRepository) DeleteByGroupID(groupID uint) error {
	return r.db.Where("group_id = ?", groupID).Delete(&model.GroupRole{}).Error
}
