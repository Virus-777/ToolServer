# Setup Instructions

## Development Mode

1. **Start the Backend Server** (in the root directory):
```bash
npm start
# or
npm run dev
```
The backend will run on `http://localhost:8085`

2. **Start the Frontend Dev Server** (in the frontend directory):
```bash
cd frontend
npm install  # First time only
npm run dev
```
The frontend will run on `http://localhost:3003`

3. **Access the Application**:
   - Open your browser and go to: `http://localhost:3003`
   - **DO NOT** try to access source files directly like `http://localhost:3003/src/pages/GPT.jsx`
   - Use the routes: `/login`, `/users`, `/gpt`, `/configs`, `/jobs`

## Production Build

1. **Build the React app**:
```bash
cd frontend
npm run build
```

2. **Start the server** (it will serve the built files):
```bash
npm start
```

3. **Access the application**:
   - Open your browser and go to: `http://localhost:8085`

## Common Issues

### ERR_BLOCKED_BY_CLIENT
- This usually means you're trying to access source files directly
- **Solution**: Access the app through the root URL (`http://localhost:3003` or `http://localhost:8085`)
- Use routes like `/gpt` instead of `/src/pages/GPT.jsx`

### Port Already in Use
- If port 3003 is in use, Vite will automatically try the next available port
- Check the terminal output for the actual port number

### API Connection Issues
- Make sure the backend server is running on port 8085
- Check that the proxy configuration in `vite.config.js` is correct
