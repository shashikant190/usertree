const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();

// Initialize Supabase with error checking
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error('Supabase environment variables not configured!');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);

// Enhanced CORS configuration
app.use(cors({
  origin: [
    'https://usertree.vercel.app',
    'https://tree-builder-zeta.vercel.app',
    'http://localhost:3000' // For local testing
  ],
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400
}));

app.use(express.json());

// Helper function with timezone awareness
const getCurrentDate = () => {
  const now = new Date();
  return new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
    .toISOString()
    .split('T')[0];
};

// Enhanced increment endpoint with better error handling
app.post('/api/increment', async (req, res) => {
  const currentDate = getCurrentDate();
  console.log(`Increment request received for date: ${currentDate}`);

  try {
    // Check existing count
    const { data: existing, error: selectError } = await supabase
      .from('user_counts_tree')
      .select('count')
      .eq('date', currentDate)
      .single();

    if (selectError && selectError.code !== 'PGRST116') { // Ignore "No rows found" error
      console.error('Supabase select error:', selectError);
      return res.status(500).json({ 
        error: 'Database error',
        details: selectError.message 
      });
    }

    if (existing) {
      // Update existing count
      const { data: updated, error: updateError } = await supabase
        .from('user_counts_tree')
        .update({ count: existing.count + 1 })
        .eq('date', currentDate)
        .single();

      if (updateError) throw updateError;
      
      console.log(`Updated count to ${updated.count} for ${currentDate}`);
      return res.json({ 
        date: currentDate, 
        count: updated.count,
        operation: 'update'
      });
    }

    // Create new entry
    const { data: newEntry, error: insertError } = await supabase
      .from('user_counts_tree')
      .insert([{ date: currentDate, count: 1 }])
      .single();

    if (insertError) throw insertError;
    
    console.log(`Created new entry for ${currentDate}`);
    return res.json({ 
      date: currentDate, 
      count: newEntry.count,
      operation: 'create'
    });

  } catch (error) {
    console.error('Full error stack:', error.stack);
    return res.status(500).json({
      error: 'Database operation failed',
      details: error.message,
      code: error.code,
      hint: error.hint
    });
  }
});

// Enhanced logs endpoint with caching
app.get('/api/logs', async (req, res) => {
  console.log('Logs request received');
  
  try {
    const { data: logs, error } = await supabase
      .from('user_counts_tree')
      .select('date,count')
      .order('date', { ascending: false });

    if (error) throw error;

    // Add caching headers
    res.set('Cache-Control', 'public, max-age=300');
    
    return res.json(logs || []);

  } catch (error) {
    console.error('Logs error:', error);
    return res.status(500).json({
      error: 'Failed to fetch logs',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabaseConnected: !!supabase
  });
});

module.exports = app;