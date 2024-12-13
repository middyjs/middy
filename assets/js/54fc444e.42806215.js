"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[8492],{2256:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>a,contentTitle:()=>r,default:()=>p,frontMatter:()=>c,metadata:()=>s,toc:()=>d});const s=JSON.parse('{"id":"best-practices/connection-reuse","title":"Connection reuse","description":"Be sure to set the following environment variable when connecting to AWS services:","source":"@site/docs/best-practices/02-connection-reuse.md","sourceDirName":"best-practices","slug":"/best-practices/connection-reuse","permalink":"/docs/best-practices/connection-reuse","draft":false,"unlisted":false,"editUrl":"https://github.com/middyjs/middy/tree/main/website/docs/best-practices/02-connection-reuse.md","tags":[],"version":"current","lastUpdatedAt":1734112351000,"sidebarPosition":2,"frontMatter":{"title":"Connection reuse","sidebar_position":2},"sidebar":"tutorialSidebar","previous":{"title":"Intro","permalink":"/docs/best-practices/intro"},"next":{"title":"Internal Context","permalink":"/docs/best-practices/internal-context"}}');var o=n(4848),i=n(8453);const c={title:"Connection reuse",sidebar_position:2},r=void 0,a={},d=[];function l(e){const t={a:"a",code:"code",p:"p",pre:"pre",...(0,i.R)(),...e.components};return(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(t.p,{children:"Be sure to set the following environment variable when connecting to AWS services:"}),"\n",(0,o.jsx)(t.pre,{children:(0,o.jsx)(t.code,{className:"language-plain",children:"AWS_NODEJS_CONNECTION_REUSE_ENABLED=1\n"})}),"\n",(0,o.jsx)(t.p,{children:"This allows you to reuse the first connection established across lambda invocations."}),"\n",(0,o.jsxs)(t.p,{children:["See ",(0,o.jsx)(t.a,{href:"https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/node-reusing-connections.html",children:"Reusing Connections with Keep-Alive in Node.js"})]})]})}function p(e={}){const{wrapper:t}={...(0,i.R)(),...e.components};return t?(0,o.jsx)(t,{...e,children:(0,o.jsx)(l,{...e})}):l(e)}},8453:(e,t,n)=>{n.d(t,{R:()=>c,x:()=>r});var s=n(6540);const o={},i=s.createContext(o);function c(e){const t=s.useContext(i);return s.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function r(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(o):e.components||o:c(e.components),s.createElement(i.Provider,{value:t},e.children)}}}]);