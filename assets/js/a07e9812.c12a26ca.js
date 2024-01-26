"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[2511],{6916:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>d,contentTitle:()=>r,default:()=>m,frontMatter:()=>o,metadata:()=>a,toc:()=>c});var s=n(5893),i=n(1151);const o={title:"RDS"},r=void 0,a={id:"events/rds",title:"RDS",description:"This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.",source:"@site/docs/events/rds.md",sourceDirName:"events",slug:"/events/rds",permalink:"/docs/events/rds",draft:!1,unlisted:!1,editUrl:"https://github.com/middyjs/middy/tree/main/website/docs/events/rds.md",tags:[],version:"current",lastUpdatedAt:1706282055,formattedLastUpdatedAt:"Jan 26, 2024",frontMatter:{title:"RDS"},sidebar:"tutorialSidebar",previous:{title:"MQ",permalink:"/docs/events/mq"},next:{title:"S3 Batch",permalink:"/docs/events/s3-batch"}},d={},c=[{value:"AWS Documentation",id:"aws-documentation",level:2},{value:"Example",id:"example",level:2}];function l(e){const t={a:"a",admonition:"admonition",code:"code",h2:"h2",li:"li",p:"p",pre:"pre",ul:"ul",...(0,i.a)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(t.admonition,{type:"caution",children:(0,s.jsx)(t.p,{children:"This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub."})}),"\n",(0,s.jsx)(t.h2,{id:"aws-documentation",children:"AWS Documentation"}),"\n",(0,s.jsxs)(t.ul,{children:["\n",(0,s.jsx)(t.li,{children:(0,s.jsx)(t.a,{href:"https://docs.aws.amazon.com/lambda/latest/dg/services-rds.html",children:"Using AWS Lambda with Amazon RDS"})}),"\n"]}),"\n",(0,s.jsx)(t.h2,{id:"example",children:"Example"}),"\n",(0,s.jsx)(t.pre,{children:(0,s.jsx)(t.code,{className:"language-javascript",children:"import middy from '@middy/core'\nimport eventNormalizerMiddleware from '@middy/event-normalizer'\n\nexport const handler = middy()\n  .use(eventNormalizerMiddleware()) // RDS -> SNS -> Lambda\n  .handler((event, context, {signal}) => {\n    // ...\n  })\n"})})]})}function m(e={}){const{wrapper:t}={...(0,i.a)(),...e.components};return t?(0,s.jsx)(t,{...e,children:(0,s.jsx)(l,{...e})}):l(e)}},1151:(e,t,n)=>{n.d(t,{Z:()=>a,a:()=>r});var s=n(7294);const i={},o=s.createContext(i);function r(e){const t=s.useContext(o);return s.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function a(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:r(e.components),s.createElement(o.Provider,{value:t},e.children)}}}]);