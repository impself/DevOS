package document

import "errors"

// Sentinel errors — handler 用 errors.Is() 匹配。
var (
	ErrDocumentNotFound = errors.New("document not found")
	ErrNoPermission     = errors.New("no permission to access this document")
)
