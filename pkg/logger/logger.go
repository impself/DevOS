// Package logger 提供全局日志实例。
// 基于 zap，支持 debug（控制台彩色）和 release（JSON）两种模式。
package logger

import (
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// L 全局 SugaredLogger 实例，初始化后可直接使用。
// 使用 SugaredLogger 而非 Logger，提供更方便的 printf 风格 API。
var L *zap.SugaredLogger

// Init 初始化日志。mode 为 "debug" 时输出彩色控制台日志，"release" 时输出 JSON。
func Init(mode string) {
	var core zapcore.Core

	encoderConfig := zapcore.EncoderConfig{
		TimeKey:        "ts",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		MessageKey:     "msg",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.MillisDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	}

	if mode == "release" {
		// 生产环境：JSON 格式，Info 级别以上
		core = zapcore.NewCore(
			zapcore.NewJSONEncoder(encoderConfig),
			zapcore.AddSync(os.Stdout),
			zapcore.InfoLevel,
		)
	} else {
		// 开发环境：彩色控制台，Debug 级别以上
		encoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
		core = zapcore.NewCore(
			zapcore.NewConsoleEncoder(encoderConfig),
			zapcore.AddSync(os.Stdout),
			zapcore.DebugLevel,
		)
	}

	logger := zap.New(core, zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel))
	L = logger.Sugar()
}
