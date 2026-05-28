// Package collab 提供 WebSocket 协同编辑的实时消息转发。
package collab

import "sync"

// Hub 管理所有协同编辑房间（每个文档一个房间）。
type Hub struct {
	mu         sync.RWMutex
	rooms      map[string]map[*Client]struct{} // docID → connected clients
	register   chan *Client
	unregister chan *Client
	broadcast  chan *broadcastMsg
}

// broadcastMsg 待广播的消息。
type broadcastMsg struct {
	docID  string
	data   []byte
	sender *Client
}

// NewHub 创建 Hub 实例。
func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[string]map[*Client]struct{}),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *broadcastMsg, 256),
	}
}

// Run 启动 Hub 事件循环，必须在单独 goroutine 中运行。
func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			if h.rooms[c.docID] == nil {
				h.rooms[c.docID] = make(map[*Client]struct{})
			}
			h.rooms[c.docID][c] = struct{}{}
			h.mu.Unlock()

		case c := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.rooms[c.docID]; ok {
				delete(clients, c)
				if len(clients) == 0 {
					delete(h.rooms, c.docID)
				}
			}
			h.mu.Unlock()
			close(c.send)

		case msg := <-h.broadcast:
			h.mu.RLock()
			clients := h.rooms[msg.docID]
			h.mu.RUnlock()

			for c := range clients {
				if c == msg.sender {
					continue
				}
				select {
				case c.send <- msg.data:
				default:
					// 发送缓冲区满，踢掉慢客户端
					h.mu.Lock()
					if room, ok := h.rooms[msg.docID]; ok {
						delete(room, c)
						if len(room) == 0 {
							delete(h.rooms, msg.docID)
						}
					}
					h.mu.Unlock()
					close(c.send)
				}
			}
		}
	}
}

// Register 注册客户端到房间。
func (h *Hub) Register(c *Client) { h.register <- c }

// Unregister 从房间移除客户端。
func (h *Hub) Unregister(c *Client) { h.unregister <- c }

// Broadcast 转发消息给同房间其他客户端。
func (h *Hub) Broadcast(docID string, data []byte, sender *Client) {
	h.broadcast <- &broadcastMsg{docID: docID, data: data, sender: sender}
}

// RoomCount 返回指定文档房间的在线人数。
func (h *Hub) RoomCount(docID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.rooms[docID])
}
