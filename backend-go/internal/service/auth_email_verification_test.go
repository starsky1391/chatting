package service

import (
	"strings"
	"testing"
	"time"

	"chat-backend/internal/config"
	"chat-backend/internal/repository"
)

func TestEmailVerificationServiceVerifyAndConsume(t *testing.T) {
	verifier := NewEmailVerificationService(nil, config.EmailConfig{
		CodeTTLMinutes:      10,
		CodeCooldownSeconds: 60,
		QueueSize:           2,
	}, config.KafkaConfig{}, nil)

	email := "verify@example.test"
	code := "123456"
	if err := verifier.storeCode(email, hashEmailCode(email, code), 10*time.Minute, time.Now().Add(10*time.Minute)); err != nil {
		t.Fatalf("store code: %v", err)
	}

	if err := verifier.VerifyRegistrationCode(email, "000000"); err == nil {
		t.Fatalf("expected wrong code to fail")
	}
	if err := verifier.VerifyRegistrationCode(email, code); err != nil {
		t.Fatalf("expected correct code to pass: %v", err)
	}

	verifier.ConsumeRegistrationCode(email)
	if err := verifier.VerifyRegistrationCode(email, code); err == nil {
		t.Fatalf("expected consumed code to fail")
	}
}

func TestEmailVerificationPurposesAreIsolated(t *testing.T) {
	verifier := NewEmailVerificationService(nil, config.EmailConfig{
		CodeTTLMinutes:      10,
		CodeCooldownSeconds: 60,
		QueueSize:           2,
	}, config.KafkaConfig{}, nil)

	email := "purpose@example.test"
	code := "123456"
	if err := verifier.storeCode(email, hashEmailCode(email, code), 10*time.Minute, time.Now().Add(10*time.Minute)); err != nil {
		t.Fatalf("store registration code: %v", err)
	}

	if err := verifier.VerifyPasswordResetCode(email, code); err == nil {
		t.Fatalf("expected registration code not to work for password reset")
	}
}

func TestAuthRegisterRequiresEmailCode(t *testing.T) {
	db := openServiceTestDB(t)
	prefix := "auth_email_code"
	cleanupServiceTestData(t, db, prefix)

	userRepo := repository.NewUserRepository(db)
	verifier := NewEmailVerificationService(userRepo, config.EmailConfig{
		CodeTTLMinutes:      10,
		CodeCooldownSeconds: 60,
		QueueSize:           2,
	}, config.KafkaConfig{}, nil)
	authService := NewAuthService(userRepo, nil, nil, verifier)

	email := prefix + "_user@example.test"
	if err := verifier.storeCode(email, hashEmailCode(email, "123456"), 10*time.Minute, time.Now().Add(10*time.Minute)); err != nil {
		t.Fatalf("store code: %v", err)
	}

	_, err := authService.Register(RegisterInput{
		Username:         prefix + "_bad",
		Email:            email,
		Password:         "123456",
		VerificationCode: "000000",
	})
	if err == nil || !strings.Contains(err.Error(), "invalid verification code") {
		t.Fatalf("expected invalid code error, got %v", err)
	}

	result, err := authService.Register(RegisterInput{
		Username:         prefix + "_ok",
		Email:            email,
		Password:         "123456",
		VerificationCode: "123456",
	})
	if err != nil {
		t.Fatalf("register with valid code: %v", err)
	}
	if result.User.Email != email {
		t.Fatalf("expected registered email %s, got %s", email, result.User.Email)
	}
	if err := verifier.VerifyRegistrationCode(email, "123456"); err == nil {
		t.Fatalf("expected successful registration to consume code")
	}
}

func TestRequestRegistrationCodeRejectsDuplicateEmail(t *testing.T) {
	db := openServiceTestDB(t)
	prefix := "auth_email_duplicate"
	cleanupServiceTestData(t, db, prefix)

	userRepo := repository.NewUserRepository(db)
	verifier := NewEmailVerificationService(userRepo, config.EmailConfig{
		CodeTTLMinutes:      10,
		CodeCooldownSeconds: 60,
		QueueSize:           2,
	}, config.KafkaConfig{}, nil)
	authService := NewAuthService(userRepo, nil, nil, verifier)

	email := prefix + "_user@example.test"
	if err := verifier.storeCode(email, hashEmailCode(email, "123456"), 10*time.Minute, time.Now().Add(10*time.Minute)); err != nil {
		t.Fatalf("store code: %v", err)
	}
	if _, err := authService.Register(RegisterInput{
		Username:         prefix + "_ok",
		Email:            email,
		Password:         "123456",
		VerificationCode: "123456",
	}); err != nil {
		t.Fatalf("register setup user: %v", err)
	}

	err := verifier.RequestRegistrationCode(email)
	if err == nil || !strings.Contains(err.Error(), "email already exists") {
		t.Fatalf("expected duplicate email error, got %v", err)
	}
}

func TestAuthResetPasswordRequiresResetCode(t *testing.T) {
	db := openServiceTestDB(t)
	prefix := "auth_reset_password"
	cleanupServiceTestData(t, db, prefix)

	userRepo := repository.NewUserRepository(db)
	verifier := NewEmailVerificationService(userRepo, config.EmailConfig{
		CodeTTLMinutes:      10,
		CodeCooldownSeconds: 60,
		QueueSize:           2,
	}, config.KafkaConfig{}, nil)
	authService := NewAuthService(userRepo, nil, nil, verifier)

	email := prefix + "_user@example.test"
	if err := verifier.storeCode(email, hashEmailCode(email, "123456"), 10*time.Minute, time.Now().Add(10*time.Minute)); err != nil {
		t.Fatalf("store register code: %v", err)
	}
	if _, err := authService.Register(RegisterInput{
		Username:         prefix + "_ok",
		Email:            email,
		Password:         "oldpass",
		VerificationCode: "123456",
	}); err != nil {
		t.Fatalf("register setup user: %v", err)
	}

	if err := verifier.storePurposeCode(email, emailVerificationPurposeResetPassword, hashEmailCode(email, "654321"), 10*time.Minute, time.Now().Add(10*time.Minute)); err != nil {
		t.Fatalf("store reset code: %v", err)
	}

	err := authService.ResetPassword(ResetPasswordInput{
		Email:            email,
		VerificationCode: "000000",
		Password:         "newpass",
		ConfirmPassword:  "newpass",
	})
	if err == nil || !strings.Contains(err.Error(), "invalid verification code") {
		t.Fatalf("expected invalid reset code error, got %v", err)
	}

	if err := authService.ResetPassword(ResetPasswordInput{
		Email:            email,
		VerificationCode: "654321",
		Password:         "newpass",
		ConfirmPassword:  "different",
	}); err == nil || !strings.Contains(err.Error(), "passwords do not match") {
		t.Fatalf("expected password mismatch error, got %v", err)
	}

	if err := authService.ResetPassword(ResetPasswordInput{
		Email:            email,
		VerificationCode: "654321",
		Password:         "newpass",
		ConfirmPassword:  "newpass",
	}); err != nil {
		t.Fatalf("reset password: %v", err)
	}

	if _, err := authService.Login(LoginInput{Email: email, Password: "oldpass"}); err == nil {
		t.Fatalf("expected old password to fail")
	}
	if _, err := authService.Login(LoginInput{Email: email, Password: "newpass"}); err != nil {
		t.Fatalf("expected new password to work: %v", err)
	}
	if err := verifier.VerifyPasswordResetCode(email, "654321"); err == nil {
		t.Fatalf("expected successful reset to consume code")
	}
}
