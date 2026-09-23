const express = require('express');

const supabase = require('../supabase.js');

const {
  authRequired,
  adminOnly
} = require('../middleware/auth');

const router = express.Router();

router.use(authRequired);

// Anyone logged in can see the holiday calendar.
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .order('date', { ascending: true });

    if (error) {
      console.error('Get holidays error:', error);
      return res.status(500).json({
        error: 'Failed to load holidays'
      });
    }

    const holidays = data.map(h => ({
      id: h.id,
      date: h.date,
      name: h.name,
      description: h.description || '',
      createdAt: h.created_at
    }));

    res.json(holidays);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


// Everything below is HR/Admin only.
router.use(adminOnly);


// Add holiday
router.post('/', async (req, res) => {
  try {
    const {
      date,
      name,
      description
    } = req.body || {};

    if (!date || !name) {
      return res.status(400).json({
        error: 'date and name are required'
      });
    }

    const { data: existing, error: checkError } = await supabase
      .from('holidays')
      .select('id')
      .eq('date', date)
      .maybeSingle();

    if (checkError) {
      console.error(checkError);
      return res.status(500).json({
        error: 'Database error'
      });
    }

    if (existing) {
      return res.status(409).json({
        error: 'A holiday is already set for this date'
      });
    }

    const { data: holiday, error } = await supabase
      .from('holidays')
      .insert({
        date,
        name,
        description: description || ''
      })
      .select('*')
      .single();

    if (error) {
      console.error('Create holiday error:', error);
      return res.status(500).json({
        error: 'Failed to create holiday'
      });
    }

    res.status(201).json({
      id: holiday.id,
      date: holiday.date,
      name: holiday.name,
      description: holiday.description || '',
      createdAt: holiday.created_at
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


// Update holiday
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    const { data: holiday, error: findError } = await supabase
      .from('holidays')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (findError) {
      console.error(findError);
      return res.status(500).json({
        error: 'Database error'
      });
    }

    if (!holiday) {
      return res.status(404).json({
        error: 'Holiday not found'
      });
    }

    const {
      date,
      name,
      description
    } = req.body || {};

    if (
      date &&
      date !== holiday.date
    ) {
      const { data: duplicate } = await supabase
        .from('holidays')
        .select('id')
        .eq('date', date)
        .neq('id', id)
        .maybeSingle();

      if (duplicate) {
        return res.status(409).json({
          error: 'A holiday is already set for this date'
        });
      }
    }

    const updates = {};

    if (date) {
      updates.date = date;
    }

    if (name) {
      updates.name = name;
    }

    if (description !== undefined) {
      updates.description = description;
    }

    const { data: updated, error } = await supabase
      .from('holidays')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Update holiday error:', error);
      return res.status(500).json({
        error: 'Failed to update holiday'
      });
    }

    res.json({
      id: updated.id,
      date: updated.date,
      name: updated.name,
      description: updated.description || '',
      createdAt: updated.created_at
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});


// Delete holiday
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    const { data: holiday, error: findError } = await supabase
      .from('holidays')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (findError) {
      console.error(findError);
      return res.status(500).json({
        error: 'Database error'
      });
    }

    if (!holiday) {
      return res.status(404).json({
        error: 'Holiday not found'
      });
    }

    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete holiday error:', error);
      return res.status(500).json({
        error: 'Failed to delete holiday'
      });
    }

    res.json({
      success: true
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

module.exports = router;