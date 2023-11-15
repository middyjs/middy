"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[527],{6831:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>d,contentTitle:()=>r,default:()=>h,frontMatter:()=>o,metadata:()=>a,toc:()=>l});var i=n(5893),s=n(1151);const o={title:"Testing",position:5},r=void 0,a={id:"intro/testing",title:"Testing",description:"This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.",source:"@site/docs/intro/06-testing.md",sourceDirName:"intro",slug:"/intro/testing",permalink:"/docs/intro/testing",draft:!1,unlisted:!1,editUrl:"https://github.com/middyjs/middy/tree/main/website/docs/intro/06-testing.md",tags:[],version:"current",lastUpdatedAt:1700079159,formattedLastUpdatedAt:"Nov 15, 2023",sidebarPosition:6,frontMatter:{title:"Testing",position:5},sidebar:"tutorialSidebar",previous:{title:"Streamify Response",permalink:"/docs/intro/streamify-response"},next:{title:"Use with TypeScript",permalink:"/docs/intro/typescript"}},d={},l=[];function c(e){const t={admonition:"admonition",code:"code",li:"li",ol:"ol",p:"p",pre:"pre",...(0,s.a)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.admonition,{type:"caution",children:(0,i.jsx)(t.p,{children:"This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub."})}),"\n",(0,i.jsx)(t.p,{children:"As of Middy v3, by default it will trigger an Abort signal shortly before a lambda times out to allow your handler to safely stop up and middleware to clean before the lambda terminates.\nWhen writing tests for lambda handlers wrapped with middy you'll need to account for this. There are a few  approaches:"}),"\n",(0,i.jsxs)(t.ol,{children:["\n",(0,i.jsxs)(t.li,{children:["Set ",(0,i.jsx)(t.code,{children:"middy(handler, { timeoutEarlyInMillis: 0 })"})," to alternatively disable the creation of the AbortController."]}),"\n",(0,i.jsxs)(t.li,{children:["Set ",(0,i.jsx)(t.code,{children:"middy(handler, { timeoutEarlyResponse: () => {} })"})," to disable the timeout error from being thrown using a no-op."]}),"\n",(0,i.jsxs)(t.li,{children:["Set ",(0,i.jsx)(t.code,{children:"context.getRemainingTimeInMillis = falsy"})," to disable the creation of the AbortController."]}),"\n"]}),"\n",(0,i.jsxs)(t.p,{children:["When using Middy ",(0,i.jsx)(t.code,{children:"cache"})," and ",(0,i.jsx)(t.code,{children:"cacheExpiry"})," in unit tests for functions in your code, it is important to conditionally disable them for test cases by setting both Middy ",(0,i.jsx)(t.code,{children:"options"})," fields as follows:"]}),"\n",(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{children:"{\n  cache: false,\n  cacheExpiry: 0,\n  ...\n}\n"})}),"\n",(0,i.jsx)(t.p,{children:"Failing to do so may make the tests end with unfinished worker processes. Although they may still succeed, this can cause issues and timeout errors, namely in CI/CD environments."}),"\n",(0,i.jsx)(t.p,{children:"An example of a message generated by Jest unit tests and which signals the need for this is as follows:"}),"\n",(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{children:"A worker process has failed to exit gracefully and has been force exited. This is likely caused by tests leaking due to improper teardown. Try running with --detectOpenHandles to find leaks. Active timers can also cause this, ensure that .unref() was called on them.\n"})})]})}function h(e={}){const{wrapper:t}={...(0,s.a)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(c,{...e})}):c(e)}},1151:(e,t,n)=>{n.d(t,{Z:()=>a,a:()=>r});var i=n(7294);const s={},o=i.createContext(s);function r(e){const t=i.useContext(o);return i.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function a(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:r(e.components),i.createElement(o.Provider,{value:t},e.children)}}}]);