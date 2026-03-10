const fs = require("fs");
const path = require("path");
const { nodeResolve } = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const peerDepsExternal = require('rollup-plugin-peer-deps-external');
const ts = require("typescript");

const packageJson = require("./package.json");
const extensions = ['.mjs', '.js', '.json', '.node', '.ts'];

function transpileTypeScript() {
  const compilerOptions = {
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    jsx: ts.JsxEmit.React,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    sourceMap: true,
    target: ts.ScriptTarget.ES2019,
  };

  return {
    name: 'transpile-typescript',
    transform(code, id) {
      if (!id.endsWith('.ts')) {
        return null;
      }

      const result = ts.transpileModule(code, {
        compilerOptions,
        fileName: id,
      });

      return {
        code: result.outputText,
        map: result.sourceMapText ? JSON.parse(result.sourceMapText) : null,
      };
    },
  };
}

function writeDeclarationEntry() {
  return {
    name: 'write-declaration-entry',
    writeBundle() {
      fs.mkdirSync(path.resolve(__dirname, 'dist'), { recursive: true });
      fs.writeFileSync(
        path.resolve(__dirname, 'dist/index.d.ts'),
        [
          "export * from '../src/index';",
          '',
        ].join('\n')
      );
    },
  };
}

module.exports = {
  input: "src/index.ts",
  output: [
    {
      file: packageJson.main,
      format: "cjs",
      sourcemap: true,
    },
    {
      file: packageJson.module,
      format: "esm",
      sourcemap: true,
    },
  ],
  plugins: [
    peerDepsExternal(),
    nodeResolve({
      extensions,
      preferBuiltins: true,
    }),
    commonjs(),
    transpileTypeScript(),
    writeDeclarationEntry(),
  ],
};