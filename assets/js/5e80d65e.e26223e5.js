"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[1436],{9114:(e,r,t)=>{t.r(r),t.d(r,{assets:()=>c,contentTitle:()=>s,default:()=>h,frontMatter:()=>i,metadata:()=>d,toc:()=>a});var o=t(5893),n=t(1151);const i={title:"Hooks",position:2},s=void 0,d={id:"intro/hooks",title:"Hooks",description:"Middy provides hooks into it's core to allow for monitoring, setup, and cleaning that may not be possible within a middleware.",source:"@site/docs/intro/07-hooks.md",sourceDirName:"intro",slug:"/intro/hooks",permalink:"/docs/intro/hooks",draft:!1,unlisted:!1,editUrl:"https://github.com/middyjs/middy/tree/main/website/docs/intro/07-hooks.md",tags:[],version:"current",lastUpdatedAt:1700079159,formattedLastUpdatedAt:"Nov 15, 2023",sidebarPosition:7,frontMatter:{title:"Hooks",position:2},sidebar:"tutorialSidebar",previous:{title:"Use with TypeScript",permalink:"/docs/intro/typescript"},next:{title:"History",permalink:"/docs/intro/history"}},c={},a=[];function l(e){const r={a:"a",code:"code",li:"li",p:"p",ul:"ul",...(0,n.a)(),...e.components};return(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(r.p,{children:"Middy provides hooks into it's core to allow for monitoring, setup, and cleaning that may not be possible within a middleware."}),"\n",(0,o.jsx)(r.p,{children:"In order of execution"}),"\n",(0,o.jsxs)(r.ul,{children:["\n",(0,o.jsxs)(r.li,{children:[(0,o.jsx)(r.code,{children:"beforePrefetch"}),"(): Triggered once before middlewares are attached and prefetches are executed."]}),"\n",(0,o.jsxs)(r.li,{children:[(0,o.jsx)(r.code,{children:"requestStart"}),"(): Triggered on every request before the first middleware."]}),"\n",(0,o.jsxs)(r.li,{children:[(0,o.jsx)(r.code,{children:"beforeMiddleware"}),"/",(0,o.jsx)(r.code,{children:"afterMiddleware"}),"(fctName): Triggered before/after every ",(0,o.jsx)(r.code,{children:"before"}),", ",(0,o.jsx)(r.code,{children:"after"}),", and ",(0,o.jsx)(r.code,{children:"onError"})," middleware function. The function name is passed in, this is why all middlewares use a verbose naming pattern."]}),"\n",(0,o.jsxs)(r.li,{children:[(0,o.jsx)(r.code,{children:"beforeHandler"}),"/",(0,o.jsx)(r.code,{children:"afterHandler"}),"(): Triggered before/after the handler."]}),"\n",(0,o.jsxs)(r.li,{children:[(0,o.jsx)(r.code,{children:"requestEnd"}),"(request): Triggered right before the response is returned, including thrown errors."]}),"\n"]}),"\n",(0,o.jsxs)(r.p,{children:["See ",(0,o.jsx)(r.a,{href:"https://middy.js.org/docs/best-practices/profiling",children:"Profiling"})," for example usage."]})]})}function h(e={}){const{wrapper:r}={...(0,n.a)(),...e.components};return r?(0,o.jsx)(r,{...e,children:(0,o.jsx)(l,{...e})}):l(e)}},1151:(e,r,t)=>{t.d(r,{Z:()=>d,a:()=>s});var o=t(7294);const n={},i=o.createContext(n);function s(e){const r=o.useContext(i);return o.useMemo((function(){return"function"==typeof e?e(r):{...r,...e}}),[r,e])}function d(e){let r;return r=e.disableParentContext?"function"==typeof e.components?e.components(n):e.components||n:s(e.components),o.createElement(i.Provider,{value:r},e.children)}}}]);