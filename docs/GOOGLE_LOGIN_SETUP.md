# Google 登录设置

应用代码与数据库字段已就绪。Supabase Google provider 仍未启用，真实 Google 登录需完成以下配置后验证。

## 1. Google Cloud 创建 OAuth 应用

打开 https://console.cloud.google.com/auth/overview ，选择或建立自己的项目。

在 Google Auth Platform 完成 Branding（应用名称 `2ndCFO`、支持邮箱、开发者联系邮箱）与 Audience 设置。用于个人 Gmail 测试时选择 External；Testing 模式下在 Test users 加入自己测试用的 Google 邮箱。

只使用登录所需的 `openid`、email、profile 范围，不请求 Drive、Gmail 或支付权限。

进入 Clients → Create client，选择 Web application，名称可填 `2ndCFO local`。

Authorized JavaScript origins:

```text
http://127.0.0.1:3000
```

Authorized redirect URIs（注意这里是 Supabase 地址，不是 localhost）:

```text
https://adiaqoqjmjevvqmtdpnn.supabase.co/auth/v1/callback
```

创建后保存 Client ID 与 Client Secret。Secret 只填入 Supabase，不要发到聊天或提交到代码。

## 2. Supabase 配置 Google

打开 https://supabase.com/dashboard/project/adiaqoqjmjevvqmtdpnn/auth/providers 。选择 Google，填写 Client ID 和 Client Secret，启用并保存。保持 nonce 验证开启。

打开 https://supabase.com/dashboard/project/adiaqoqjmjevvqmtdpnn/auth/url-configuration 。

Site URL:

```text
http://127.0.0.1:3000
```

Additional Redirect URLs 添加下面这条仅用于本机的规则，允许回调携带随机 state 查询参数：

```text
http://127.0.0.1:3000/api/auth/google/callback**
```

只对本机回调路径使用这条规则。正式部署时配置实际 HTTPS 域名并重新检查重定向限制。服务器 APP_ORIGIN 必须与用户访问的网站一致。

## 3. 验证

- 新邮箱：登录页 Continue with Google → 选择测试 Google 账户 → 返回私人工作空间。
- 已有邮箱密码账户：先按原方式登录，再 Settings → Link Google account。选择与现有账号相同的 Google 邮箱，保留现有公司与权限。之后可以直接用 Google 登录。
- 取消授权后应可重新尝试；退出后应不能访问受保护数据。
- 不会仅凭相同邮箱自动合并旧账户；未验证邮箱、错误身份、过期或伪造回调不得创建应用会话。

## Implementation and verification

Server-side Supabase SDK PKCE flow, HttpOnly ten-minute pending cookie, random callback state, fixed APP_ORIGIN, server-verified Google identity, and existing opaque eight-hour application session. Google/Supabase access and refresh tokens are not persisted in the browser. Existing authorization and company membership checks remain in place. A Google-only account has an unexposed random password hash; password recovery remains a separate future feature.

Automated tests cover verified identity requirements, new-user creation, stable identity reuse, safe explicit linking, and preservation of existing memberships. HTTP checks cover CSRF, disabled-provider handling and forged callback rejection. A real successful Google consent round trip has not yet been tested because the Google client is not configured.

Reference: https://supabase.com/docs/guides/auth/social-login/auth-google
