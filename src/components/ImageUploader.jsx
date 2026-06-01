import { useRef } from 'react'
import { Box, Button, Typography } from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import CloseIcon from '@mui/icons-material/Close'

function ImageUploader({ onImageSelect, imagePreview }) {
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file && file.type.startsWith('image/')) {
      onImageSelect(file)
    }
  }

  return (
    <Box>
      {imagePreview ? (
        <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)' }}>
          <img
            src={imagePreview}
            alt="预览"
            style={{ width: '100%', maxHeight: 420, objectFit: 'contain', display: 'block' }}
          />
          <Button
            size="small"
            onClick={() => { onImageSelect(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
            sx={{
              position: 'absolute', top: 8, right: 8,
              minWidth: 32, width: 32, height: 32, borderRadius: '50%',
              backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff',
              '&:hover': { backgroundColor: '#c62828' }
            }}
          >
            <CloseIcon fontSize="small" />
          </Button>
        </Box>
      ) : (
        <Box
          sx={{
            border: '2px dashed', borderColor: 'divider', borderRadius: 2,
            p: { xs: 3, md: 5 }, textAlign: 'center',
            transition: 'all 0.3s',
            '&:hover': { borderColor: 'primary.main', backgroundColor: 'rgba(30,58,95,0.02)' }
          }}
        >
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: 'none' }} />
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ px: 3 }}
            >
              选择照片
            </Button>
            <Button
              variant="outlined"
              startIcon={<CameraAltIcon />}
              onClick={() => cameraInputRef.current?.click()}
              sx={{ px: 3 }}
            >
              拍照上传
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            支持 JPG、PNG、WEBP 格式，自动压缩优化
          </Typography>
        </Box>
      )}
    </Box>
  )
}

export default ImageUploader
