# Stabilization fixtures

Fixture 源文件由 `scripts/build-test-fixtures.js` 确定性生成，不在仓库中提交二进制 PDF/EPUB。

```bash
npm run fixtures:build
```

默认输出：

```text
tests/.generated/fixtures
```

使用隔离数据目录启动服务：

```bash
export LUCUBRO_DATA_DIR=/tmp/lucubro-e2e
npm run fixtures:seed -- --clean
node server.js
```

安全限制：

- `fixtures:seed` 默认拒绝写入仓库的 `data/courses`。
- `--clean` 默认只清理带 `.lucubro-e2e-data` 标记的目录。
- 必须显式使用 `--force` 才能覆盖这些保护。
