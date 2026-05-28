package collab

import (
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 1 << 20 // 1 MB
	sendBufSize    = 256
)

// StateStore 持久化 Yjs 二进制状态。
type StateStore interface {
	GetYjsState(docID string) ([]byte, error)
	SaveYjsState(docID string, state []byte) error
}

// 消息类型前缀字节，客户端和服务端共用。
const (
	MsgUpdate    = 0 // Yjs 增量更新，广播给其他客户端
	MsgAwareness = 1 // Awareness 状态，广播给其他客户端
	MsgSyncState = 2 // 完整 Yjs 状态快照，服务端持久化
)

// Client 代表一个 WebSocket 协同编辑连接。
type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	docID  string
	userID string
	send   chan []byte
	store  StateStore
}

// NewClient 创建协同编辑客户端。
func NewClient(hub *Hub, conn *websocket.Conn, docID, userID string, store StateStore) *Client {
	return &Client{
		hub:    hub,
		conn:   conn,
		docID:  docID,
		userID: userID,
		send:   make(chan []byte, sendBufSize),
		store:  store,
	}
}

// ReadPump 从 WebSocket 读取客户端消息，转发给 Hub。
func (c *Client) ReadPump() {
	defer func() {
		c.hub.Unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, msg, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("collab read error: %v", err)
			}
			return
		}

		if len(msg) < 1 {
			continue
		}

		msgType := msg[0]
		payload := msg[1:]

		switch msgType {
		case MsgUpdate, MsgAwareness:
			// 广播原始消息（含前缀）给同房间其他客户端
			c.hub.Broadcast(c.docID, msg, c)

		case MsgSyncState:
			// 客户端发送完整状态快照，持久化到 DB
			if len(payload) > 0 {
				if err := c.store.SaveYjsState(c.docID, payload); err != nil {
					log.Printf("save yjs state error: doc=%s err=%v", c.docID, err)
				}
			}
		}
	}
}

// WritePump 向 WebSocket 写入消息（广播 + ping）。
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.BinaryMessage, msg); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
