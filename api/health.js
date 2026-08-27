export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'healthy',
    service: 'nebula-revenue-backend',
    runtime: 'vercel-serverless',
    timestamp: new Date().toISOString()
  });
}
