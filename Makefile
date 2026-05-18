.PHONY: run build test migrate docker-up docker-down clean

# 启动开发服务
run:
	go run cmd/server/main.go
npmrun:
	cd frontend && npm run dev
# 编译
build:
	go build -o bin/devos cmd/server/main.go

# 运行测试
test:
	go test ./... -v -cover

# 运行 lint
lint:
	golangci-lint run ./...

# 启动依赖服务
docker-up:
	docker compose -f deploy/docker-compose.yml up -d

# 停止依赖服务
docker-down:
	docker compose -f deploy/docker-compose.yml down

# 数据库迁移
migrate-up:
	migrate -path migrations -database "postgres://devos:devos@localhost:5432/devos?sslmode=disable" up

migrate-down:
	migrate -path migrations -database "postgres://devos:devos@localhost:5432/devos?sslmode=disable" down 1

# 清理
clean:
	rm -rf bin/
	go clean -cache
