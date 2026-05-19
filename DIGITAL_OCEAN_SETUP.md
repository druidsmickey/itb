# Digital Ocean Setup Guide for WhatsApp Integration

## Issue: QR Code Not Generating

If WhatsApp QR codes are not appearing on Digital Ocean, it's likely due to missing Chrome/Chromium dependencies.

## Solution: Install Chrome Dependencies

SSH into your Digital Ocean droplet and run these commands:

### For Ubuntu/Debian:

```bash
# Update package list
sudo apt-get update

# Install Chrome dependencies
sudo apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  lsb-release \
  wget \
  xdg-utils

# Clean up
sudo apt-get clean
```

### Alternative: Install Chromium

```bash
sudo apt-get install -y chromium-browser
```

## Verify Installation

After installing dependencies:

1. **Restart your Node.js backend:**
   ```bash
   pm2 restart backend  # or however you manage your process
   # OR
   sudo systemctl restart your-app-name
   ```

2. **Check logs for QR code generation:**
   ```bash
   pm2 logs backend
   # Look for: "✅ QR Code received! Length: ..."
   ```

3. **Test in the app:**
   - Go to WhatsApp → Connection tab
   - Click "Reset & New QR"
   - Wait 10-20 seconds
   - QR code should appear below the buttons

## Debugging

### Check Backend Logs

```bash
# If using pm2
pm2 logs backend --lines 100

# If using systemd
sudo journalctl -u your-app-name -n 100 -f
```

### Look for These Log Messages:

- `📱 Calling client.initialize()...` - Initialization started
- `Loading screen: X% ...` - WhatsApp Web is loading
- `✅ QR Code received! Length: ...` - QR code generated successfully
- `❌ Client initialization error: ...` - Check error details

### Common Errors:

**Error: Failed to launch the browser process**
- Missing Chrome dependencies (install using commands above)

**Error: EACCES: permission denied**
- Backend doesn't have permission to create `.wwebjs_auth` folder
- Fix: `sudo chown -R $USER:$USER /path/to/backend/.wwebjs_auth`

**Timeout after 3 minutes**
- Server might be too slow
- Check server resources: `htop` or `top`
- Consider upgrading droplet size

## Memory Requirements

WhatsApp-web.js with Puppeteer requires:
- **Minimum:** 1GB RAM
- **Recommended:** 2GB RAM or more

Check current memory usage:
```bash
free -h
```

## Firewall

Ensure your backend port (default 3000) is accessible:
```bash
sudo ufw allow 3000
sudo ufw status
```

## Environment Variables

Make sure your backend `.env` file exists:
```bash
cd /path/to/backend
cat .env
```

Should contain:
```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=3000
```

## Still Not Working?

1. **Check if Puppeteer can launch:**
   ```bash
   cd /path/to/backend
   node -e "const puppeteer = require('puppeteer'); (async () => { const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] }); console.log('✅ Puppeteer works!'); await browser.close(); })();"
   ```

2. **Check Node.js version:**
   ```bash
   node --version  # Should be 16+ (18+ recommended)
   ```

3. **Reinstall node_modules:**
   ```bash
   cd /path/to/backend
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Contact Support:**
   - Include backend logs
   - Include output from Puppeteer test above
   - Specify your droplet specs (RAM, CPU, OS version)
