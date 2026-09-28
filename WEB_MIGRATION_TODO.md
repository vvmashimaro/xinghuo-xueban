# Web Frontend Migration TODO

## Pages to Update

### 1. login.html
**Current**: Direct SMS verify → setSession → navigate
**New**: SMS verify → get ticket → login with ticket → store token → navigate

Changes needed:
- Update `handleLoginSubmit` to call `StorageService.verifySMS` then `StorageService.login(ticket, role)`
- Remove all `setSession` calls
- Token is automatically stored by `login()`

### 2. parent_register.html  
**Current**: SMS verify → setSession → saveParent → navigate
**New**: SMS verify → get ticket → register with ticket → store token → navigate

Changes needed:
- Update registration flow to call `StorageService.verifySMS` then `StorageService.register(ticket, 'parent', profile)`
- Remove `setSession` calls

### 3. index.html (mentor onboarding)
**Current**: SMS verify → setSession → addMentor → navigate
**New**: SMS verify → get ticket → register with ticket → store token → navigate

Changes needed:
- Update to use `StorageService.register(ticket, 'mentor', profile)`

### 4. mentor_dashboard.html
**Current**: Uses session, calls setSession at line ~1144
**New**: Check `StorageService.isLoggedIn()`, get user from `getCurrentUser()`

Changes needed:
- Remove setSession calls
- Check auth at page load
- Redirect to login if not authenticated

### 5. parent_dashboard.html
**Current**: Uses session
**New**: Same as mentor_dashboard

### 6. admin_audit.html
**Current**: Allows 888888 mock login
**New**: Require real admin auth (ADMIN_PHONES or ADMIN_TOKEN)

Changes needed:
- Check user.role === 'admin' from getCurrentUser()
- Redirect if not admin

## Storage Service Updates Needed

✅ Added `verifySMS(phone, code, scene)` - returns `{success, ticket, ...}`
✅ Updated `login(ticket, role)` - takes ticket instead of phone/code
✅ Updated `register(ticket, role, profile)` - takes ticket instead of phone/code
✅ Updated `hydrateFromServer()` - fetches scoped data for non-admin

## Testing Checklist

- [ ] Parent login with 888888 works
- [ ] Mentor login with 888888 works
- [ ] Admin login with 888888 is rejected (requires ADMIN_PHONES)
- [ ] Parent registration works
- [ ] Mentor registration works  
- [ ] Dashboard pages check auth and redirect
- [ ] Token persists across page loads
- [ ] Logout clears token and redirects
- [ ] Server restart doesn't log everyone out (tokens in db)
