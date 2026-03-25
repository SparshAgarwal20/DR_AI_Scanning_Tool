IF DB_ID('DRData') IS NULL
BEGIN
    CREATE DATABASE [DRData];
END;
GO

USE [DRData];
GO

IF OBJECT_ID('dbo.UnprocessedImages', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UnprocessedImages (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        FileName NVARCHAR(255) NOT NULL,
        FilePath NVARCHAR(1000) NOT NULL,
        Quality NVARCHAR(50) NOT NULL,
        Reason NVARCHAR(255) NOT NULL,
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_UnprocessedImages_CreatedAt DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF OBJECT_ID('dbo.DR_Predictions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DR_Predictions (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        FileName NVARCHAR(255) NOT NULL,
        FilePath NVARCHAR(1000) NOT NULL,
        Severity NVARCHAR(100) NOT NULL,
        Confidence DECIMAL(8,4) NOT NULL,
        CreatedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_DR_Predictions_CreatedAt DEFAULT SYSUTCDATETIME(),
        EtDrsScore DECIMAL(10,2) NULL,
        EtDrsLabel NVARCHAR(100) NULL,
        EtDrsDescription NVARCHAR(500) NULL
    );
END;
GO