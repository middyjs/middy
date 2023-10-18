"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[6540],{3905:(e,n,t)=>{t.d(n,{Zo:()=>c,kt:()=>b});var s=t(7294);function r(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}function a(e,n){var t=Object.keys(e);if(Object.getOwnPropertySymbols){var s=Object.getOwnPropertySymbols(e);n&&(s=s.filter((function(n){return Object.getOwnPropertyDescriptor(e,n).enumerable}))),t.push.apply(t,s)}return t}function l(e){for(var n=1;n<arguments.length;n++){var t=null!=arguments[n]?arguments[n]:{};n%2?a(Object(t),!0).forEach((function(n){r(e,n,t[n])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(t)):a(Object(t)).forEach((function(n){Object.defineProperty(e,n,Object.getOwnPropertyDescriptor(t,n))}))}return e}function i(e,n){if(null==e)return{};var t,s,r=function(e,n){if(null==e)return{};var t,s,r={},a=Object.keys(e);for(s=0;s<a.length;s++)t=a[s],n.indexOf(t)>=0||(r[t]=e[t]);return r}(e,n);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(s=0;s<a.length;s++)t=a[s],n.indexOf(t)>=0||Object.prototype.propertyIsEnumerable.call(e,t)&&(r[t]=e[t])}return r}var o=s.createContext({}),d=function(e){var n=s.useContext(o),t=n;return e&&(t="function"==typeof e?e(n):l(l({},n),e)),t},c=function(e){var n=d(e.components);return s.createElement(o.Provider,{value:n},e.children)},p="mdxType",u={inlineCode:"code",wrapper:function(e){var n=e.children;return s.createElement(s.Fragment,{},n)}},m=s.forwardRef((function(e,n){var t=e.components,r=e.mdxType,a=e.originalType,o=e.parentName,c=i(e,["components","mdxType","originalType","parentName"]),p=d(t),m=r,b=p["".concat(o,".").concat(m)]||p[m]||u[m]||a;return t?s.createElement(b,l(l({ref:n},c),{},{components:t})):s.createElement(b,l({ref:n},c))}));function b(e,n){var t=arguments,r=n&&n.mdxType;if("string"==typeof e||r){var a=t.length,l=new Array(a);l[0]=m;var i={};for(var o in n)hasOwnProperty.call(n,o)&&(i[o]=n[o]);i.originalType=e,i[p]="string"==typeof e?e:r,l[1]=i;for(var d=2;d<a;d++)l[d]=t[d];return s.createElement.apply(null,l)}return s.createElement.apply(null,t)}m.displayName="MDXCreateElement"},9398:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>o,contentTitle:()=>l,default:()=>u,frontMatter:()=>a,metadata:()=>i,toc:()=>d});var s=t(7462),r=(t(7294),t(3905));const a={title:"Bundling Lambda packages",sidebar_position:5},l=void 0,i={unversionedId:"best-practices/bundling",id:"best-practices/bundling",title:"Bundling Lambda packages",description:"This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.",source:"@site/docs/best-practices/05-bundling.md",sourceDirName:"best-practices",slug:"/best-practices/bundling",permalink:"/docs/best-practices/bundling",draft:!1,editUrl:"https://github.com/middyjs/middy/tree/main/website/docs/best-practices/05-bundling.md",tags:[],version:"current",lastUpdatedAt:1697596175,formattedLastUpdatedAt:"Oct 18, 2023",sidebarPosition:5,frontMatter:{title:"Bundling Lambda packages",sidebar_position:5},sidebar:"tutorialSidebar",previous:{title:"Internal Context",permalink:"/docs/best-practices/internal-context"},next:{title:"Small node_modules",permalink:"/docs/best-practices/small-node-modules"}},o={},d=[{value:"Compilers",id:"compilers",level:2},{value:"typescript",id:"typescript",level:3},{value:"tsconfig.json",id:"tsconfigjson",level:4},{value:"Bundlers",id:"bundlers",level:2},{value:"esbuild",id:"esbuild",level:3},{value:"rollup",id:"rollup",level:3},{value:"rollup.config.mjs",id:"rollupconfigmjs",level:4},{value:"swc/pack",id:"swcpack",level:3},{value:"webpack",id:"webpack",level:3},{value:"webpack.config.mjs",id:"webpackconfigmjs",level:4},{value:"Transpilers",id:"transpilers",level:2},{value:"babel",id:"babel",level:3},{value:"babel.config.json",id:"babelconfigjson",level:4},{value:"esbuild",id:"esbuild-1",level:3},{value:"swc",id:"swc",level:3},{value:".swcrc",id:"swcrc",level:4}],c={toc:d},p="wrapper";function u(e){let{components:n,...t}=e;return(0,r.kt)(p,(0,s.Z)({},c,t,{components:n,mdxType:"MDXLayout"}),(0,r.kt)("admonition",{type:"caution"},(0,r.kt)("p",{parentName:"admonition"},"This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.")),(0,r.kt)("p",null,"Always bundle the ",(0,r.kt)("inlineCode",{parentName:"p"},"@aws-sdk/*")," with your project eventhough the Lambda runtime already includes it by default (Note: nodejs16.x does not have AWS SDK v3 included).\nThis gives you full control of when to update the SDK to prevent unexpected errors from a bad SDK version, allows you to ensure that you are running the latest version with the most up to date fixes and features, and has been shown to decrease cold start times."),(0,r.kt)("h2",{id:"compilers"},"Compilers"),(0,r.kt)("h3",{id:"typescript"},"typescript"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"npm i -D typescript\nnode_modules/.bin/tsc\n")),(0,r.kt)("h4",{id:"tsconfigjson"},"tsconfig.json"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-json"},'{\n  "compilerOptions": {\n    "baseUrl": "./",\n    "esModuleInterop": true,\n    "preserveConstEnums": true,\n    "strictNullChecks": true,\n    "allowJs": false,\n    "target": "es2021",\n    "typeRoots": ["node_modules/@types"],\n    "resolveJsonModule": true,\n    "moduleResolution": "node"\n  }\n}\n')),(0,r.kt)("h2",{id:"bundlers"},"Bundlers"),(0,r.kt)("h3",{id:"esbuild"},"esbuild"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"npm i -D esbuild\n\n# --banner:js hack from https://github.com/evanw/esbuild/pull/2067\nnode_modules/.bin/esbuild index.js \\\n    --platform=node --format=esm  --target=node18 --bundle --minify \\\n    --banner:js=\"import { createRequire } from 'module';const require = createRequire(import.meta.url);\" \\\n    --legal-comments=external --sourcemap=external \\\n    --allow-overwrite --outfile=index.mjs\n\n")),(0,r.kt)("h3",{id:"rollup"},"rollup"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"npm i -D rollup @rollup/plugin-node-resolve @rollup/plugin-commonjs\nnode_modules/.bin/rollup --config\n")),(0,r.kt)("h4",{id:"rollupconfigmjs"},"rollup.config.mjs"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-javascript"},"import { nodeResolve } from '@rollup/plugin-node-resolve'\nimport commonjs from '@rollup/plugin-commonjs'\n\nconst plugins = [nodeResolve({ preferBuiltins: true }), commonjs()]\n\nexport default (input) => ({\n  input: 'index.js',\n  output: {\n    file: 'index.bundle.rollup.mjs',\n    format: 'es' // cjs, es\n  },\n  plugins,\n  external: [\n    // AWS SDK\n    '@aws-sdk/client-apigatewaymanagementapi', // @middy/ws-response\n    '@aws-sdk/client-rds', // @middy/rds-signer\n    '@aws-sdk/client-s3', // @middy/s3-object-response\n    '@aws-sdk/client-secretsmanager', // @middy/sercrets-manager\n    '@aws-sdk/client-servicediscovery', // @middy/service-discovery\n    '@aws-sdk/client-ssm', // @middy/ssm\n    '@aws-sdk/client-sts' // @middy/sts\n  ]\n})\n")),(0,r.kt)("h3",{id:"swcpack"},"swc/pack"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"npm i -D @swc/cli @swc/core\nnode_modules/.bin/spack\n")),(0,r.kt)("admonition",{type:"caution"},(0,r.kt)("p",{parentName:"admonition"},"Incomplete")),(0,r.kt)("h3",{id:"webpack"},"webpack"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"npm i -D webpack-cli webpack\nnode_modules/.bin/webpack\n")),(0,r.kt)("h4",{id:"webpackconfigmjs"},"webpack.config.mjs"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-javascript"},"import path from 'node:path'\nimport { fileURLToPath } from 'node:url'\n\nconst __filename = fileURLToPath(import.meta.url)\nconst __dirname = path.dirname(__filename)\n\nexport default {\n  mode: 'development',\n  entry: './index.js',\n  output: {\n    filename: 'index.bundle.webpack.mjs',\n    path: __dirname\n  },\n  experiments: {\n    outputModule: true\n  },\n  externals: [\n    // NodeJS modules\n    'events', // @middy/core\n    'https', // @middy/s3-object-response\n    'stream', // @middy/http-content-encoding @middy/s3-object-response\n    'util', // @middy/http-content-encoding\n    'zlib', // @middy/http-content-encoding\n    // AWS SDK\n    '@aws-sdk/client-apigatewaymanagementapi', // @middy/ws-response\n    '@aws-sdk/client-rds', // @middy/rds-signer\n    '@aws-sdk/client-s3', // @middy/s3-object-response\n    '@aws-sdk/client-secretsmanager', // @middy/sercrets-manager\n    '@aws-sdk/client-servicediscovery', // @middy/service-discovery\n    '@aws-sdk/client-ssm', // @middy/ssm\n    '@aws-sdk/client-sts' // @middy/sts\n  ]\n}\n")),(0,r.kt)("h2",{id:"transpilers"},"Transpilers"),(0,r.kt)("h3",{id:"babel"},"babel"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"npm i -D @babel/cli @babel/core @babel/preset-env\nnode_modules/.bin/babel index.js --out-file index.transpile.babel.cjs\n")),(0,r.kt)("h4",{id:"babelconfigjson"},"babel.config.json"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-json"},'{\n  "presets": [\n    [\n      "@babel/preset-env",\n      {\n        "targets": {\n          "node": "16"\n        }\n      }\n    ]\n  ]\n}\n')),(0,r.kt)("h3",{id:"esbuild-1"},"esbuild"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"npm i -D esbuild\nnode_modules/.bin/esbuild --platform=node --target=node16 --format=cjs index.js --outfile=index.cjs\n")),(0,r.kt)("h3",{id:"swc"},"swc"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-bash"},"npm i -D @swc/cli @swc/core\nnode_modules/.bin/swc index.js --out-file index.transpile.swc.cjs\n")),(0,r.kt)("h4",{id:"swcrc"},".swcrc"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-json"},'{\n  "jsc": {\n    "parser": {\n      "syntax": "ecmascript"\n    },\n    "target": "es2021"\n  },\n  "module": {\n    "type": "commonjs"\n  }\n}\n')))}u.isMDXComponent=!0}}]);