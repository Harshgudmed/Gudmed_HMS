# 🤖 AUTOMATIC DEPLOYMENT SETUP

I've created GitHub Actions workflows for automatic deployment!

## What This Does

Every time you push code to GitHub, it automatically:
- ✅ Deploys frontend to Vercel
- ✅ Deploys backend to Railway
- ✅ No manual steps needed!

---

## 🚀 Setup (5 minutes)

### **Step 1: Get Vercel Token**

1. Go to: https://vercel.com/account/tokens
2. Click: "Create Token"
3. Name: "GitHub Actions"
4. Copy the token (save it temporarily)

### **Step 2: Get Vercel Project Info**

1. Go to: https://vercel.com/dashboard
2. Click: Your project name
3. Go to: Settings → General
4. Copy these values:
   - **Project ID** (under "Project ID")
   - **Org ID** (under "Team ID" or "Org ID")

### **Step 3: Get Railway Token**

1. Go to: https://railway.app
2. Click: Account settings (bottom left)
3. Go to: Tokens
4. Click: "Create New Token"
5. Copy the token (save it temporarily)

### **Step 4: Add Secrets to GitHub**

1. Go to: https://github.com/Harshgudmed/Gudmed_HMS
2. Click: Settings → Secrets and variables → Actions
3. Click: "New repository secret"
4. Add these secrets:

**Secret 1: VERCEL_TOKEN**
- Name: `VERCEL_TOKEN`
- Value: (paste token from Step 1)
- Click: Add secret

**Secret 2: VERCEL_ORG_ID**
- Name: `VERCEL_ORG_ID`
- Value: (paste Org ID from Step 2)
- Click: Add secret

**Secret 3: VERCEL_PROJECT_ID**
- Name: `VERCEL_PROJECT_ID`
- Value: (paste Project ID from Step 2)
- Click: Add secret

**Secret 4: RAILWAY_TOKEN**
- Name: `RAILWAY_TOKEN`
- Value: (paste token from Step 3)
- Click: Add secret

### **Step 5: Verify Setup**

1. Go to: GitHub Actions tab
2. You should see workflows:
   - "Deploy Frontend to Vercel"
   - "Deploy Backend to Railway"
   - "Keep Backend Awake"
3. All green = ✅ Working!

---

## ✅ Testing

After setup, test by:

1. Make a small change to frontend code
2. Commit and push: `git push origin main`
3. Go to GitHub Actions tab
4. Watch the "Deploy Frontend to Vercel" workflow run
5. When it finishes, your frontend is deployed! 🎉

---

## 📋 What Gets Deployed

### **When you push frontend changes:**
```
✅ Triggered automatically
✅ Builds frontend with Vite
✅ Deploys to Vercel
✅ Live URL: https://your-project.vercel.app
```

### **When you push backend changes:**
```
✅ Triggered automatically
✅ Deploys to Railway
✅ Restarts backend service
✅ API available at: https://your-backend.railway.app/api
```

---

## 🔍 Monitor Deployments

1. Go to: https://github.com/Harshgudmed/Gudmed_HMS
2. Click: Actions tab
3. See all deployment runs
4. Click any run to see details
5. Logs show exactly what happened

---

## 🐛 Troubleshooting

### **Workflow failed with "Invalid token"**
- Check: Token copied correctly (no extra spaces)
- Re-create token and update GitHub secret

### **Deployment succeeded but app not updating**
- Wait 5-10 minutes (propagation delay)
- Hard refresh browser (Ctrl+F5)
- Check Vercel dashboard for actual deployment status

### **Backend not deploying**
- Check: Railway service exists
- Verify: RAILWAY_TOKEN is valid
- Check: Backend folder hasn't moved

---

## 🎯 Your Deployment Flow Now

```
1. Write code
2. Commit & push to GitHub
3. GitHub Actions automatically:
   - Builds
   - Tests
   - Deploys to Vercel/Railway
4. App is live! ✅
```

**No manual deployment needed anymore!**

---

## 📊 Cost

```
Vercel:  FREE (generous free tier)
Railway: FREE (generous free tier)
GitHub:  FREE (Actions included)

Total cost: $0 🎉
```

---

## 🚀 Next Steps

1. **Complete setup above** (5 minutes)
2. **Push a test change** to trigger deployment
3. **Watch it deploy automatically!** 🎊

---

## ✨ You Now Have:

✅ Automatic frontend deployment  
✅ Automatic backend deployment  
✅ No manual steps needed  
✅ Scales automatically  
✅ Free hosting  
✅ Professional setup  

---

**You're enterprise-ready! 🚀**
