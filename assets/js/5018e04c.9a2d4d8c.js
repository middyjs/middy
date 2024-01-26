"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[9862],{2258:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>d,contentTitle:()=>o,default:()=>p,frontMatter:()=>i,metadata:()=>a,toc:()=>c});var r=n(5893),s=n(1151);const i={title:"Use with TypeScript",position:6},o=void 0,a={id:"intro/typescript",title:"Use with TypeScript",description:"Middy can be used with TypeScript with typings built in in every official package.",source:"@site/docs/intro/06-typescript.md",sourceDirName:"intro",slug:"/intro/typescript",permalink:"/docs/intro/typescript",draft:!1,unlisted:!1,editUrl:"https://github.com/middyjs/middy/tree/main/website/docs/intro/06-typescript.md",tags:[],version:"current",lastUpdatedAt:1706282055,formattedLastUpdatedAt:"Jan 26, 2024",sidebarPosition:6,frontMatter:{title:"Use with TypeScript",position:6},sidebar:"tutorialSidebar",previous:{title:"Testing",permalink:"/docs/intro/testing"},next:{title:"Hooks",permalink:"/docs/intro/hooks"}},d={},c=[];function l(e){const t={a:"a",code:"code",em:"em",p:"p",pre:"pre",...(0,s.a)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(t.p,{children:"Middy can be used with TypeScript with typings built in in every official package."}),"\n",(0,r.jsx)(t.p,{children:"You may need to install additional types for AWS Lambda events."}),"\n",(0,r.jsx)(t.pre,{children:(0,r.jsx)(t.code,{className:"language-bash",children:"npm i -D @types/aws-lambda\n"})}),"\n",(0,r.jsx)(t.p,{children:"Here's an example of how you might be using Middy with TypeScript for a Lambda receiving events from API Gateway and fetching secrets from Secrets Manager:"}),"\n",(0,r.jsx)(t.pre,{children:(0,r.jsx)(t.code,{className:"language-typescript",children:"import middy from '@middy/core'\nimport secretsManager from '@middy/secrets-manager'\nimport { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'\n\nexport const handler = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()\n  .use(\n    secretsManager({\n      fetchData: {\n        apiToken: 'dev/api_token'\n      },\n      awsClientOptions: {\n        region: 'us-east-1'\n      },\n      setToContext: true\n    })\n  )\n  .handler(async (req, context) => {\n    // The context type gets augmented here by the secretsManager middleware.\n    // This is just an example, obviously don't ever log your secret in real life!\n    console.log(context.apiToken)\n    return {\n      statusCode: 200,\n      body: JSON.stringify({\n        message: `Hello from ${event.path}`,\n        req\n      })\n    }\n  })\n"})}),"\n",(0,r.jsxs)(t.p,{children:["Note that when using TypeScript, you should use what we call the ",(0,r.jsx)(t.em,{children:"Middleware-first, Handler-last"})," approach, which means that you should always call the ",(0,r.jsx)(t.code,{children:"handler"})," method last, after you have attached all the middlewares you need."]}),"\n",(0,r.jsxs)(t.p,{children:["This approach makes sure that, as you attach middlewares, the type system understands how the ",(0,r.jsx)(t.code,{children:"event"})," and the ",(0,r.jsx)(t.code,{children:"context"})," arguments are augmented by the various middlewares and inside your handler code you can have a nice type-checking and auto-completion experience."]}),"\n",(0,r.jsxs)(t.p,{children:["You can also ",(0,r.jsx)(t.a,{href:"/docs/writing-middlewares/intro",children:"write custom middlewares with TypeScript"}),"."]}),"\n",(0,r.jsx)(t.p,{children:"This is an example tsconfig.json file that can be used for typescript projects"}),"\n",(0,r.jsx)(t.pre,{children:(0,r.jsx)(t.code,{children:'{\n  "compilerOptions": {\n    "incremental": true,\n    "target": "es2020",\n    "module": "es2020",\n    "declaration": true,\n    "sourceMap": true,\n    "composite": true,\n    "strict": true,\n    "moduleResolution": "node",\n    "esModuleInterop": true,\n    "skipLibCheck": true,\n    "forceConsistentCasingInFileNames": true,\n    "preserveConstEnums": true,\n    "resolveJsonModule": true,\n    "allowJs": true,\n    "rootDir": ".",\n    "outDir": "lib"\n  }\n  "include": ["src/**/*", "tests/**/*"],\n  "exclude": ["node_modules"]\n}\n\n'})})]})}function p(e={}){const{wrapper:t}={...(0,s.a)(),...e.components};return t?(0,r.jsx)(t,{...e,children:(0,r.jsx)(l,{...e})}):l(e)}},1151:(e,t,n)=>{n.d(t,{Z:()=>a,a:()=>o});var r=n(7294);const s={},i=r.createContext(s);function o(e){const t=r.useContext(i);return r.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function a(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:o(e.components),r.createElement(i.Provider,{value:t},e.children)}}}]);