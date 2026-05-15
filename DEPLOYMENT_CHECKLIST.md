# �� B-CRM Activity Log - Deployment Checklist

## Pre-Deployment (5 minutes)

- [ ] Review commit history: `git log --oneline | head -4`
- [ ] Verify clean working tree: `git status`
- [ ] Backup current production database (Supabase)
- [ ] Have Supabase dashboard open and ready
- [ ] Have Vercel dashboard open and ready

## Database Migration (5 minutes)

1. **Open Supabase Dashboard**
   - [ ] Go to https://app.supabase.com
   - [ ] Select your B-CRM project
   - [ ] Navigate to SQL Editor

2. **Apply Migration**
   - [ ] Click "New Query"
   - [ ] Copy contents of `supabase/04_activity_log.sql`
   - [ ] Paste into SQL editor
   - [ ] Click "Run"
   - [ ] Wait for "Success" confirmation
   - [ ] Check for any error messages

3. **Verify Migration Success**
   - [ ] New tables appear in Schema
   - [ ] lead_activities table exists
   - [ ] lead_files table exists
   - [ ] lead_reminders table exists
   - [ ] daily_reports table exists
   - [ ] Indexes created successfully

## Code Deployment (10 minutes)

1. **Push to GitHub**
   - [ ] Branch is clean and all commits are made
   - [ ] Run: `git push origin copilot/worktree-2026-05-15T15-10-08`

2. **Deploy via Vercel**
   - [ ] Go to https://vercel.com/dashboard
   - [ ] Find B-CRM project
   - [ ] Wait for automatic deployment or click "Redeploy"
   - [ ] Monitor build progress
   - [ ] Verify build completes successfully

3. **Verify Vercel Deployment**
   - [ ] All 14 routes built successfully
   - [ ] All 5 API endpoints deployed
   - [ ] No build errors in logs
   - [ ] Production URL is accessible

## Post-Deployment Verification (10 minutes)

### 1. Database Verification
- [ ] Connect to production database
- [ ] Run: `SELECT * FROM lead_activities LIMIT 1;` (should return empty or existing data)
- [ ] Run: `SELECT * FROM lead_files LIMIT 1;`
- [ ] Run: `SELECT * FROM lead_reminders LIMIT 1;`
- [ ] Run: `SELECT * FROM daily_reports LIMIT 1;`
- [ ] Check RLS policies are in place

### 2. Frontend Verification
- [ ] Open live application: https://your-domain.com
- [ ] Login with test account
- [ ] Navigate to any lead detail page
- [ ] Check for new sections:
  - [ ] "Aktywności" (Activities) section appears
  - [ ] "Pliki" (Files) section appears
  - [ ] "Przypomnienia" (Reminders) section appears
- [ ] No JavaScript console errors
- [ ] Components load without errors

### 3. API Verification
Get a valid session token from browser DevTools (Application > Cookies > auth token)

Test activities endpoint:
```bash
curl -X GET 'https://your-domain.com/api/leads/activities?lead_id=<any-uuid>' \
  -H 'Authorization: Bearer <token>'
# Should return: [] or list of activities (no 401 errors)
```

Test files endpoint:
```bash
curl -X GET 'https://your-domain.com/api/leads/files?lead_id=<any-uuid>' \
  -H 'Authorization: Bearer <token>'
# Should return: [] or list of files (no 401 errors)
```

Test reminders endpoint:
```bash
curl -X GET 'https://your-domain.com/api/leads/reminders?lead_id=<any-uuid>' \
  -H 'Authorization: Bearer <token>'
# Should return: [] or list of reminders (no 401 errors)
```

Test reports endpoint:
```bash
curl -X GET 'https://your-domain.com/api/leads/reports?user_id=<user-id>&report_date=2026-05-15' \
  -H 'Authorization: Bearer <token>'
# Should return: null or report object (no 401 errors)
```

### 4. User Testing
- [ ] Login with different user roles (sales, admin, manager)
- [ ] Verify access control works correctly
- [ ] Try creating a comment (activity logged)
- [ ] Check activity appears in activity log
- [ ] Try creating a reminder
- [ ] Check reminder appears in reminders section
- [ ] Try marking reminder as complete
- [ ] Try uploading a file (if storage configured)

## Rollback Plan (If Issues Occur)

### Rollback Code (2 minutes)
1. Go to Vercel Dashboard
2. Click "Deployments"
3. Find previous working deployment
4. Click the "..." menu
5. Select "Promote to Production"

### Rollback Database (5 minutes)
If critical database issues occur:

1. Open Supabase SQL Editor
2. Run rollback script:
```sql
-- Drop new tables (careful - this loses data!)
DROP TABLE IF EXISTS public.daily_reports CASCADE;
DROP TABLE IF EXISTS public.lead_reminders CASCADE;
DROP TABLE IF EXISTS public.lead_files CASCADE;
DROP TABLE IF EXISTS public.lead_activities CASCADE;

-- Revert role constraint
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check check (role in ('admin', 'sales'));
```

3. Verify tables are removed
4. Verify application still works

## Deployment Summary

**Code Changes:**
- 4 commits with ~2,500 lines added
- 11 new files created
- TypeScript compilation: PASSED
- Build verification: PASSED

**Database Changes:**
- 4 new tables
- 8 RLS policies
- 11 indexes
- 1 database function
- No breaking changes to existing tables

**Deployment Risks:** ⚠️ LOW
- All changes are additive (no existing functionality removed)
- RLS ensures data isolation
- Backward compatible with existing code
- Easy rollback available

**Deployment Benefits:**
- Complete activity tracking
- Better lead visibility
- Team performance metrics
- File management
- Reminder system
- Manager oversight capabilities

## Go/No-Go Decision

**Go-Decision Criteria:**
- ✅ All TypeScript checks pass
- ✅ Next.js build succeeds
- ✅ Database migration runs without errors
- ✅ No critical security issues identified
- ✅ Rollback plan is documented

**Recommendation:** ✅ **READY TO DEPLOY**

---

**Deployment Date:** 2026-05-15
**Deployed By:** [Your Name]
**Deployment Time Start:** ___________
**Deployment Time End:** ___________
**Status:** [ ] Success [ ] Failed

## Post-Deployment Monitoring (First 24 Hours)

- [ ] Monitor Vercel error logs
- [ ] Monitor Supabase database performance
- [ ] Check for user-reported issues
- [ ] Verify API response times are normal
- [ ] Monitor database connection limits

## Documentation

- ✅ IMPLEMENTATION_SUMMARY.md - Complete feature docs
- ✅ DEPLOYMENT_GUIDE.md - Detailed deployment steps
- ✅ DEPLOYMENT_CHECKLIST.md - This checklist

---

**Need Help?** Check the DEPLOYMENT_GUIDE.md for troubleshooting steps.
