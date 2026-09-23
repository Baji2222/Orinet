const express = require('express');
const supabase = require('../supabase.js');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired);


// ===========================================================================
// HELPER
// ===========================================================================

function mapPayslip(row) {
  return {
    id: row.id,

    userId: row.user_id,

    month: row.month,

    year: row.year,

    fileName: row.file_name,

    originalName: row.original_name,

    storagePath: row.storage_path,

    uploadedAt: row.uploaded_at
  };
}


// ===========================================================================
// LIST MY PAYSLIPS
// ===========================================================================

router.get('/me', async (req, res) => {
  try {

    const userId = Number(req.user.id);

    const {
      data,
      error
    } = await supabase
      .from('payslips')
      .select('*')
      .eq('user_id', userId)
      .order(
        'uploaded_at',
        {
          ascending: false
        }
      );

    if (error) {

      console.error(
        'Get employee payslips error:',
        error
      );

      return res.status(500).json({
        error:
          'Failed to load payslips'
      });
    }

    const list =
      (data || []).map(
        mapPayslip
      );

    res.json(list);

  } catch (err) {

    console.error(
      'Payslip list error:',
      err
    );

    res.status(500).json({
      error:
        'Internal server error'
    });
  }
});


// ===========================================================================
// DOWNLOAD PAYSLIP
// ===========================================================================
//
// Employees can download only their own payslips.
// Admins can download any payslip.
//

router.get(
  '/:id/download',
  async (req, res) => {

    try {

      const payslipId =
        Number(req.params.id);

      if (
        !Number.isInteger(
          payslipId
        )
      ) {
        return res.status(400).json({
          error:
            'Invalid payslip ID'
        });
      }


      // ---------------------------------------------------------
      // Find payslip in Supabase
      // ---------------------------------------------------------

      const {
        data: payslip,
        error
      } = await supabase
        .from('payslips')
        .select('*')
        .eq(
          'id',
          payslipId
        )
        .maybeSingle();

      if (error) {

        console.error(
          'Find payslip error:',
          error
        );

        return res.status(500).json({
          error:
            'Failed to find payslip'
        });
      }

      if (!payslip) {

        return res.status(404).json({
          error:
            'Payslip not found'
        });
      }


      // ---------------------------------------------------------
      // Authorization
      // ---------------------------------------------------------

      const isOwner =
        Number(
          payslip.user_id
        ) ===
        Number(
          req.user.id
        );

      const isAdmin =
        req.user.role ===
        'admin';

      if (
        !isOwner &&
        !isAdmin
      ) {
        return res.status(403).json({
          error:
            'You are not authorized to access this payslip'
        });
      }


      // ---------------------------------------------------------
      // Check Storage path
      // ---------------------------------------------------------

      if (
        !payslip.storage_path
      ) {
        return res.status(404).json({
          error:
            'Payslip file path not found'
        });
      }


      // ---------------------------------------------------------
      // Download from Supabase Storage
      // ---------------------------------------------------------

      const {
        data: fileData,
        error: downloadError
      } = await supabase
        .storage
        .from('payslips')
        .download(
          payslip.storage_path
        );

      if (downloadError) {

        console.error(
          'Supabase Storage download error:',
          downloadError
        );

        return res.status(404).json({
          error:
            'Payslip file not found in storage'
        });
      }


      // ---------------------------------------------------------
      // Convert Blob to Buffer
      // ---------------------------------------------------------

      const arrayBuffer =
        await fileData.arrayBuffer();

      const buffer =
        Buffer.from(
          arrayBuffer
        );


      // ---------------------------------------------------------
      // Set response headers
      // ---------------------------------------------------------

      const fileName =
        payslip.original_name ||
        payslip.file_name ||
        `payslip_${payslip.id}.pdf`;

      const safeFileName =
        fileName.replace(
          /["\r\n]/g,
          '_'
        );

      let contentType =
        'application/octet-stream';

      const lowerName =
        safeFileName.toLowerCase();

      if (
        lowerName.endsWith('.pdf')
      ) {
        contentType =
          'application/pdf';
      } else if (
        lowerName.endsWith('.png')
      ) {
        contentType =
          'image/png';
      } else if (
        lowerName.endsWith('.jpg') ||
        lowerName.endsWith('.jpeg')
      ) {
        contentType =
          'image/jpeg';
      }


      res.setHeader(
        'Content-Type',
        contentType
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeFileName}"`
      );

      res.setHeader(
        'Content-Length',
        buffer.length
      );


      // ---------------------------------------------------------
      // Send file
      // ---------------------------------------------------------

      return res.send(
        buffer
      );

    } catch (err) {

      console.error(
        'Payslip download error:',
        err
      );

      return res.status(500).json({
        error:
          'Failed to download payslip'
      });
    }
  }
);


module.exports = router;