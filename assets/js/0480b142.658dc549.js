"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[8070],{7208:(t,e,o)=>{o.r(e),o.d(e,{assets:()=>r,contentTitle:()=>a,default:()=>l,frontMatter:()=>d,metadata:()=>n,toc:()=>c});const n=JSON.parse('{"id":"faq","title":"FAQ","description":"My lambda keep timing out without responding, what do I do?","source":"@site/docs/faq.md","sourceDirName":".","slug":"/faq","permalink":"/docs/faq","draft":false,"unlisted":false,"editUrl":"https://github.com/middyjs/middy/tree/main/website/docs/faq.md","tags":[],"version":"current","lastUpdatedAt":1734112351000,"sidebarPosition":10,"frontMatter":{"title":"FAQ","sidebar_position":10},"sidebar":"tutorialSidebar","previous":{"title":"Profiling","permalink":"/docs/best-practices/profiling"}}');var i=o(4848),s=o(8453);const d={title:"FAQ",sidebar_position:10},a=void 0,r={},c=[{value:"My lambda keep timing out without responding, what do I do?",id:"my-lambda-keep-timing-out-without-responding-what-do-i-do",level:3}];function p(t){const e={code:"code",h3:"h3",p:"p",...(0,s.R)(),...t.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(e.h3,{id:"my-lambda-keep-timing-out-without-responding-what-do-i-do",children:"My lambda keep timing out without responding, what do I do?"}),"\n",(0,i.jsxs)(e.p,{children:["Likely your event loop is not empty. This happens when you have a database connect still open for example. Checkout ",(0,i.jsx)(e.code,{children:"@middy/do-not-wait-for-empty-event-loop"}),"."]})]})}function l(t={}){const{wrapper:e}={...(0,s.R)(),...t.components};return e?(0,i.jsx)(e,{...t,children:(0,i.jsx)(p,{...t})}):p(t)}},8453:(t,e,o)=>{o.d(e,{R:()=>d,x:()=>a});var n=o(6540);const i={},s=n.createContext(i);function d(t){const e=n.useContext(s);return n.useMemo((function(){return"function"==typeof t?t(e):{...e,...t}}),[e,t])}function a(t){let e;return e=t.disableParentContext?"function"==typeof t.components?t.components(i):t.components||i:d(t.components),n.createElement(s.Provider,{value:e},t.children)}}}]);