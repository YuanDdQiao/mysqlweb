go-bindata -debug -ignore=\\.gitignore -ignore=\\.DS_Store -ignore=\\.gitkeep static/...
go test
go build
mysqlweb.exe
