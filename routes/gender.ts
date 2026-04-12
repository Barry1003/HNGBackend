import express, { Request, Response, Router } from 'express' 
import axios from 'axios' 

const router: Router = express.Router() 

// Simple in-memory cache
const cache: Record<string, any> = {};

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

    const nameKey = name.toLowerCase().trim();

    // Check cache first
    if (cache[nameKey]) {
        console.log(`Cache hit for: ${nameKey}`);
        return res.status(200).json(cache[nameKey]);
    }

    try {
        const apiResponse = await axios.get(`https://api.genderize.io/?name=${nameKey}`) 
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
        
        const responseData = {
            status: "success",
            data: {
                name: apiData.name,
                gender: apiData.gender,
                probability: apiData.probability,
                sample_size,
                is_confident,
                processed_at
            }
        };

        // Store in cache
        cache[nameKey] = responseData;

        return res.status(200).json(responseData) 
    } catch (error: any) {
        console.error("Genderize API Error:", error.message || error);
        
        if (error.response && error.response.status === 429) {
            return res.status(429).json({
                status: "error",
                message: "Rate limit exceeded. Our server is temporarily reaching its limit with the external prediction service. Please try a name you've checked before, or try a new name in a few minutes."
            })
        }

        return res.status(502).json({
            status: "error",
            message: "Upstream or server failure"
        }) 
    }
}) 

export default router 
