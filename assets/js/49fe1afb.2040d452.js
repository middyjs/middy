"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[4679],{1607:(e,t,r)=>{r.r(t),r.d(t,{assets:()=>d,contentTitle:()=>a,default:()=>l,frontMatter:()=>s,metadata:()=>i,toc:()=>c});const i=JSON.parse('{"id":"writing-middlewares/with-typescript","title":"With TypeScript","description":"here\'s an example of how you can write a custom middleware for a Lambda receiving events from API Gateway:","source":"@site/docs/writing-middlewares/07-with-typescript.md","sourceDirName":"writing-middlewares","slug":"/writing-middlewares/with-typescript","permalink":"/docs/writing-middlewares/with-typescript","draft":false,"unlisted":false,"editUrl":"https://github.com/middyjs/middy/tree/main/website/docs/writing-middlewares/07-with-typescript.md","tags":[],"version":"current","lastUpdatedAt":1734112351000,"sidebarPosition":7,"frontMatter":{"title":"With TypeScript","position":7},"sidebar":"tutorialSidebar","previous":{"title":"More Examples","permalink":"/docs/writing-middlewares/more-examples"},"next":{"title":"Routers","permalink":"/docs/category/routers"}}');var n=r(4848),o=r(8453);const s={title:"With TypeScript",position:7},a=void 0,d={},c=[];function p(e){const t={code:"code",p:"p",pre:"pre",strong:"strong",...(0,o.R)(),...e.components};return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)(t.p,{children:"here's an example of how you can write a custom middleware for a Lambda receiving events from API Gateway:"}),"\n",(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{className:"language-typescript",children:"import middy from '@middy/core'\nimport { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'\n\nconst middleware = (): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {\n  const before: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (\n    request\n  ): Promise<APIGatewayProxyResult> => {\n    // Your middleware logic\n  }\n\n  const after: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (\n    request\n  ): Promise<void> => {\n    // Your middleware logic\n  }\n\n  return {\n    before,\n    after\n  }\n}\n\nexport default middleware\n"})}),"\n",(0,n.jsxs)(t.p,{children:[(0,n.jsx)(t.strong,{children:"Note"}),": The Middy core team does not use TypeScript often and we can't certainly claim that we are TypeScript experts. We tried our best to come up\nwith type definitions that should give TypeScript users a good experience. There is certainly room for improvement, so we would be more than happy to receive contributions \ud83d\ude0a"]}),"\n",(0,n.jsxs)(t.p,{children:["See ",(0,n.jsx)(t.code,{children:"devDependencies"})," for each middleware for list of dependencies that may be required with transpiling TypeScript."]})]})}function l(e={}){const{wrapper:t}={...(0,o.R)(),...e.components};return t?(0,n.jsx)(t,{...e,children:(0,n.jsx)(p,{...e})}):p(e)}},8453:(e,t,r)=>{r.d(t,{R:()=>s,x:()=>a});var i=r(6540);const n={},o=i.createContext(n);function s(e){const t=i.useContext(o);return i.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function a(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(n):e.components||n:s(e.components),i.createElement(o.Provider,{value:t},e.children)}}}]);