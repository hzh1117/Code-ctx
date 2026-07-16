const path = require('path');
const { spawnSync } = require('child_process');

describe('CLI help', () => {
  test('is generated from the registered Commander commands', () => {
    const cliPath = path.join(__dirname, '../../bin/cli.js');
    const result = spawnSync(process.execPath, [cliPath, '--help'], {
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.replace(/\r\n/g, '\n')).toMatchInlineSnapshot(`
"Usage: code-ctx [options] [command]

AI 开发上下文工具

Options:
  -V, --version          output the version number
  -h, --help             display help for command

Commands:
  init [options]         初始化项目，扫描结构生成 ai-docs/
  use [options] [task]   生成开发 prompt
  update [options]       检测变化，更新相关文档
  fix [options] <alias>  重新生成指定子项目的文档
  status                 查看 ai-docs 各文档的最后更新时间
  doctor [options]       检查文档健康状态
  watch [options]        监听文件变化，自动触发增量更新
  hook                   管理 git post-commit hook
  dashboard [options]    启动 Web 管理界面
  config                 检查和管理项目配置
  help [command]         display help for command
"
`);
  });
});
