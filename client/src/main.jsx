import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import store from './redux/store.jsx'
import { Provider } from 'react-redux'
import App from './App.jsx'
import { ToastContainer } from 'react-toastify';

createRoot(document.getElementById('root')).render(
  
  <Provider store={store}>

  <StrictMode>
    <App />
    <ToastContainer />
  </StrictMode>
    </Provider>

)
