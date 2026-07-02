// routes/api.js
import express from 'express';
import axios from 'axios';
import History from '../models/History.model.js';
import Collections from '../models/Collections.model.js';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Send API request
router.post('/send-request', async (req, res) => {
  try {
    const { method, url, headers, body, _id } = req.body;
    const response = await axios({
      method,
      url,
      headers,
      data: body,
      validateStatus: () => true
    });

    // Save to history

    const historyEntry = new History({
      url,
      method,
      status: response.status,
      timestamp: new Date(),
      user_id:_id
    });
    await historyEntry.save();

    res.json({
      status: response.status,
      headers: response.headers,
      body: response.data
    });
  } catch (error) {
    console.error(error);
    res.json({ error: 'Request failed' });
  }
});

// History routes
router.get('/history', async (req, res) => {
  const {_id}=req.query;
  try {
    const history = await History.find({user_id:_id})
      .sort({ timestamp: -1 })
      .limit(20);
    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not fetch history' });
  }
});


//delete history

router.post('/history/delete',async (req,res)=>{
    try {
        const { id }=req.body;
        if (!id) {
          return res.status(400).json({ error: 'History id is required' });
        }

        const result = await History.deleteOne({_id:id});
        if (result.deletedCount === 0) {
          return res.status(404).json({ error: 'History entry not found' });
        }

        res.json({message:"History deleted successfully"});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Could not delete history' });
    }
})



// Collection routes
router.post('/collections', async (req, res) => {
  try {
    const collection = new Collections(req.body);
    await collection.save();
    res.json(collection);
  } catch (error) {
    console.error(error);
    res.json({ error: 'Could not create collection' });
  }
});

router.get('/collections', async (req, res) => {
  try {  const {user_id}=req.query;

    const collections = await Collections.find({user_id}).populate('requests');
    res.json(collections);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not fetch collections' });
  }
});

router.put('/collections/:id', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Collection name is required' });
    }

    const collection = await Collections.findByIdAndUpdate(
      req.params.id,
      { name: name.trim() },
      { new: true }
    );

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    res.json(collection);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update collection' });
  }
});


// Add a request to a collection
router.post('/collections/:id/requests', async (req, res) => {
  try {
    const collection = await Collections.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const newRequest = {
      ...req.body,
      createdAt: new Date()
    };
    
    collection.requests.push(newRequest);
    await collection.save();

    res.json(collection);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add request to collection' });
  }
});

// Delete a request from a collection
router.delete('/collections/:collectionId/requests/:requestId', async (req, res) => {
  try {
    const collection = await Collections.findById(req.params.collectionId);
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const request = collection.requests.id(req.params.requestId);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    request.deleteOne();
    await collection.save();

    res.json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete request' });
  }
});

// Delete a collection
router.delete('/collections/:id', async (req, res) => {
  try {
    const collection = await Collections.findByIdAndDelete(req.params.id);
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    res.json({ message: 'Collection deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

router.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;

  const { data: tokenRes } = await axios.post(
    'https://oauth2.googleapis.com/token',
    {
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri:  'http://localhost:5000/api/auth/google/callback',
      grant_type:    'authorization_code'
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  const accessToken = tokenRes.access_token;

  const { data: profile } = await axios.get(
    'https://www.googleapis.com/oauth2/v3/userinfo',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );


console.log(profile);
  let user = await User.findOne({ googleId: profile.sub });
  if (!user) {
    user = await User.create({
      googleId: profile.sub,
      name:     profile.name,
      email:    profile.email,
      picture:   profile.picture,
         given_name:profile.given_name
    });

  }
  const appToken = jwt.sign(
    { id: profile.sub, email: profile.email},
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );


  res
  .cookie('token', appToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   1000 * 60 * 4
  })


  res.redirect(`http://localhost:5173/login/success?user=${encodeURIComponent(JSON.stringify(user))}`);
});

// Handles new user registration
router.post('/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword
    });

    const appToken = jwt.sign(
      { id: newUser._id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('token', appToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60
    });

    res.status(201).json(newUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// Authenticates a user and issues a token
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const appToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('token', appToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60
    });

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

export default router;
