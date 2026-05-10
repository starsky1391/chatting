package utils

import (
	"crypto/rand"
	"math/big"
)

const (
	inviteCodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // 去除容易混淆的字符 I, O, 0, 1
	inviteCodeLength = 12
)

// GenerateInviteCode 生成唯一邀请码
func GenerateInviteCode() string {
	code := make([]byte, inviteCodeLength)
	for i := 0; i < inviteCodeLength; i++ {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(inviteCodeChars))))
		code[i] = inviteCodeChars[n.Int64()]
	}
	return string(code)
}
