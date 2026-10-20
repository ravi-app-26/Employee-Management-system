import fs from 'fs';
import path from 'path';
import YAML from 'yaml';


const filePath = path.resolve(
  process.cwd(),
  'docs/openapi.yaml'
);


export const swaggerSpec = YAML.parse(
  fs.readFileSync(filePath, 'utf8')
);