import js from '@eslint/js';
import ts from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';

export default ts.config(
  { ignores: ['dist/**', 'node_modules/**', 'src/api/generated.d.ts', '**/*.js', 'test-results/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { files: ['src/**/*.tsx'], plugins: { 'react-hooks': hooks }, rules: { 'react-hooks/rules-of-hooks': 'error' } },
);
