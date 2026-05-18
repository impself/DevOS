// Package event 提供进程内事件总线。
// 用于模块间解耦通信：一个模块 Publish 事件，另一个模块 Subscribe 处理。
// 当前为同步调用，后续可接入 Redis Streams 实现异步。
package event

import "sync"

// Handler 事件处理函数。
type Handler func(data any)

// Bus 事件总线接口。
type Bus interface {
	// Publish 发布事件到指定 topic，同步调用所有订阅者。
	Publish(topic string, data any)
	// Subscribe 订阅指定 topic 的事件。
	Subscribe(topic string, handler Handler)
}

type bus struct {
	mu       sync.RWMutex
	handlers map[string][]Handler
}

// New 创建事件总线实例。
func New() Bus {
	return &bus{
		handlers: make(map[string][]Handler),
	}
}

func (b *bus) Publish(topic string, data any) {
	b.mu.RLock()
	handlers := b.handlers[topic]
	b.mu.RUnlock()

	// 同步调用，注意 handler 中不要阻塞
	for _, h := range handlers {
		h(data)
	}
}

func (b *bus) Subscribe(topic string, handler Handler) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handlers[topic] = append(b.handlers[topic], handler)
}
