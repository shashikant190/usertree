const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(cors());
app.use(express.json());

// Create this SQL function in Supabase first:
// CREATE OR REPLACE FUNCTION increment_count()
// RETURNS void AS $$
// BEGIN
//   INSERT INTO user_counts_tree (date, count)
//   VALUES (CURRENT_DATE, 1)
//   ON CONFLICT (date)
//   DO UPDATE SET count = user_counts_tree.count + 1;
// END;
// $$ LANGUAGE plpgsql;

app.post('/api/increment', async (req, res) => {
  try {
    // Update user_counts_tree table
    const { error } = await supabase.rpc('increment_count');
    if (error) throw error;

    // Get updated count
    const { data } = await supabase
      .from('user_counts_tree')
      .select('count')
      .eq('date', new Date().toISOString().split('T')[0])
      .single();

    res.json({ 
      date: new Date().toISOString().split('T')[0], 
      count: data?.count || 1 
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to update count' });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const { data } = await supabase
      .from('user_counts_tree')
      .select('date, count')
      .order('date', { ascending: false });

    res.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

module.exports = app;