-- Create the database
CREATE DATABASE GerenciadorFinanceiroDB;

-- Use the database
USE GerenciadorFinanceiroDB;

-- Table for monthly inputs (one row per user, assuming single user 'local-user')
CREATE TABLE monthly_inputs (
    user_id VARCHAR(50) PRIMARY KEY DEFAULT 'local-user',
    salary DECIMAL(10,2) DEFAULT 0.00,
    investments DECIMAL(10,2) DEFAULT 0.00,
    meal_voucher DECIMAL(10,2) DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table for transactions
CREATE TABLE transactions (
    id VARCHAR(50) PRIMARY KEY,
    description TEXT NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    category VARCHAR(50) DEFAULT 'outros',
    payment_method VARCHAR(50) DEFAULT 'dinheiro',
    type ENUM('income', 'expense') DEFAULT 'expense',
    timestamp DATETIME NOT NULL,
    user_id VARCHAR(50) DEFAULT 'local-user',
    FOREIGN KEY (user_id) REFERENCES monthly_inputs(user_id)
);

-- Table for investments
CREATE TABLE investments (
    id VARCHAR(50) PRIMARY KEY,
    description TEXT NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    timestamp DATETIME NOT NULL,
    user_id VARCHAR(50) DEFAULT 'local-user',
    FOREIGN KEY (user_id) REFERENCES monthly_inputs(user_id)
);

-- Insert default monthly inputs row
INSERT INTO monthly_inputs (user_id) VALUES ('local-user');
