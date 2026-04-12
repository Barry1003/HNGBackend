import express, {Request, Response} from 'express'
import axios from 'axios'
import cors from 'cors'
import 'dotenv/config.js'
import route from './routes/gender'

const app = express()
const PORT = process.env.PORT || 3000;

app.use(express.json())
app.use(cors())
app.use('/api', route)

app.listen(PORT, ()=>{
    console.log(`server is running on port: ${PORT}`)
})