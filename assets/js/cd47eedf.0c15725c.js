"use strict";(self.webpackChunkmiddy=self.webpackChunkmiddy||[]).push([[4388],{8852:(e,r,n)=>{n.r(r),n.d(r,{assets:()=>d,contentTitle:()=>a,default:()=>p,frontMatter:()=>s,metadata:()=>i,toc:()=>l});var t=n(5893),o=n(1151);const s={title:"Handling Errors",position:5},a=void 0,i={id:"intro/handling-errors",title:"Handling Errors",description:"But, what happens when there is an error?",source:"@site/docs/intro/05-handling-errors.md",sourceDirName:"intro",slug:"/intro/handling-errors",permalink:"/docs/intro/handling-errors",draft:!1,unlisted:!1,editUrl:"https://github.com/middyjs/middy/tree/main/website/docs/intro/05-handling-errors.md",tags:[],version:"current",lastUpdatedAt:1706282055,formattedLastUpdatedAt:"Jan 26, 2024",sidebarPosition:5,frontMatter:{title:"Handling Errors",position:5},sidebar:"tutorialSidebar",previous:{title:"Early return",permalink:"/docs/intro/early-interrupt"},next:{title:"Streamify Response",permalink:"/docs/intro/streamify-response"}},d={},l=[];function c(e){const r={code:"code",p:"p",pre:"pre",...(0,o.a)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(r.p,{children:"But, what happens when there is an error?"}),"\n",(0,t.jsxs)(r.p,{children:["When there is an error, the regular control flow is stopped and the execution is\nmoved back to all the middlewares that implemented a special phase called ",(0,t.jsx)(r.code,{children:"onError"}),", following\nthe same order as ",(0,t.jsx)(r.code,{children:"after"}),"."]}),"\n",(0,t.jsxs)(r.p,{children:["Every ",(0,t.jsx)(r.code,{children:"onError"})," middleware can decide to handle the error and create a proper response or\nto delegate the error to the next middleware."]}),"\n",(0,t.jsx)(r.p,{children:"When a middleware handles the error and creates a response, the execution is still propagated to all the other\nerror middlewares and they have a chance to update or replace the response as\nneeded. At the end of the error middlewares sequence, the response is returned\nto the user."}),"\n",(0,t.jsx)(r.p,{children:"If no middleware manages the error, the Lambda execution fails reporting the unmanaged error."}),"\n",(0,t.jsx)(r.pre,{children:(0,t.jsx)(r.code,{className:"language-javascript",children:"// Initialize response\nrequest.response = request.response ?? {}\n\n// Add to response\nrequest.response.add = 'more'\n\n// Override an error\nrequest.error = new Error('...')\n\n// handle the error\nreturn request.response\n"})})]})}function p(e={}){const{wrapper:r}={...(0,o.a)(),...e.components};return r?(0,t.jsx)(r,{...e,children:(0,t.jsx)(c,{...e})}):c(e)}},1151:(e,r,n)=>{n.d(r,{Z:()=>i,a:()=>a});var t=n(7294);const o={},s=t.createContext(o);function a(e){const r=t.useContext(s);return t.useMemo((function(){return"function"==typeof e?e(r):{...r,...e}}),[r,e])}function i(e){let r;return r=e.disableParentContext?"function"==typeof e.components?e.components(o):e.components||o:a(e.components),t.createElement(s.Provider,{value:r},e.children)}}}]);