import express, { Request, Response, Router } from 'express' 
import axios from 'axios' 

const router: Router = express.Router() 
router.get('/classify', async (req: Request, res: Response) => {
    const { name } = req.query 
    if (name === undefined || name === null || name === "") {
        return res.status(400).json({
            status: "error",
            message: "Missing or empty name parameter"
        }) 
    }
    if (typeof name !== 'string') {
        return res.status(422).json({
            status: "error",
            message: "name is not a string"
        }) 
    }
    try {
        const apiResponse = await axios.get(`https://api.genderize.io/?name=${name}`) 
        const apiData = apiResponse.data 
        if (apiData.gender === null || apiData.count === 0) {
            return res.status(200).json({
                status: "error",
                message: "No prediction available for the provided name"
            }) 
        }
        const sample_size = apiData.count 
        const probability = apiData.probability
        const is_confident = probability >= 0.7 && sample_size >= 100 
        const processed_at = new Date().toISOString() 
        res.setHeader('Access-Control-Allow-Origin', '*') 
        
        return res.status(200).json({
            status: "success",
            data: {
                name: apiData.name,
                gender: apiData.gender,
                probability: apiData.probability,
                sample_size,
                is_confident,
                processed_at
            }
        }) 
    } catch (error: any) {
        console.error("Comparison Error:", error.message || error);
        // Handling the upstream or server failure
        return res.status(502).json({
            status: "error",
            message: "Upstream or server failure",
            debug_info: error.message || "Unknown error"
        }) 
    }
}) 

export default router 
