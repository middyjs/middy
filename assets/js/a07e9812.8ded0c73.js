"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[8518],{5180:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>d,contentTitle:()=>a,default:()=>m,frontMatter:()=>r,metadata:()=>s,toc:()=>c});const s=JSON.parse('{"id":"events/rds","title":"RDS","description":"This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.","source":"@site/docs/events/rds.md","sourceDirName":"events","slug":"/events/rds","permalink":"/docs/events/rds","draft":false,"unlisted":false,"editUrl":"https://github.com/middyjs/middy/tree/main/website/docs/events/rds.md","tags":[],"version":"current","lastUpdatedAt":1734112351000,"frontMatter":{"title":"RDS"},"sidebar":"tutorialSidebar","previous":{"title":"MQ","permalink":"/docs/events/mq"},"next":{"title":"S3 Batch","permalink":"/docs/events/s3-batch"}}');var i=n(4848),o=n(8453);const r={title:"RDS"},a=void 0,d={},c=[{value:"AWS Documentation",id:"aws-documentation",level:2},{value:"Example",id:"example",level:2}];function l(e){const t={a:"a",admonition:"admonition",code:"code",h2:"h2",li:"li",p:"p",pre:"pre",ul:"ul",...(0,o.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.admonition,{type:"caution",children:(0,i.jsx)(t.p,{children:"This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub."})}),"\n",(0,i.jsx)(t.h2,{id:"aws-documentation",children:"AWS Documentation"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsx)(t.li,{children:(0,i.jsx)(t.a,{href:"https://docs.aws.amazon.com/lambda/latest/dg/services-rds.html",children:"Using AWS Lambda with Amazon RDS"})}),"\n"]}),"\n",(0,i.jsx)(t.h2,{id:"example",children:"Example"}),"\n",(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-javascript",children:"import middy from '@middy/core'\nimport eventNormalizerMiddleware from '@middy/event-normalizer'\n\nexport const handler = middy()\n  .use(eventNormalizerMiddleware()) // RDS -> SNS -> Lambda\n  .handler((event, context, {signal}) => {\n    // ...\n  })\n"})})]})}function m(e={}){const{wrapper:t}={...(0,o.R)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(l,{...e})}):l(e)}},8453:(e,t,n)=>{n.d(t,{R:()=>r,x:()=>a});var s=n(6540);const i={},o=s.createContext(i);function r(e){const t=s.useContext(o);return s.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function a(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:r(e.components),s.createElement(o.Provider,{value:t},e.children)}}}]);