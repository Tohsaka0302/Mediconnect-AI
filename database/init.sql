-- Create Hospitals Table
CREATE TABLE hospitals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    unique_code VARCHAR(50) UNIQUE NOT NULL
);

-- Create Doctors/Users Table (Role-based)
CREATE TABLE doctors (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Will use bcrypt
    role VARCHAR(50) DEFAULT 'doctor', -- 'admin' or 'doctor'
    hospital_id INTEGER REFERENCES hospitals(id),
    specialization VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Patients Table
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    gender VARCHAR(10),
    primary_hospital_id INTEGER REFERENCES hospitals(id)
);

-- Visit/Treatment History (Linked to AI analysis later)
CREATE TABLE visits (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id),
    doctor_id INTEGER REFERENCES doctors(id),
    visit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    symptoms TEXT,
    diagnosis TEXT,
    notes TEXT
);