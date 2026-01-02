import { LicenseManager } from 'ag-charts-enterprise';

const licenseKey = process.env.VITE_AG_GRID_LICENSE_KEY;

export function setAgChartLicense() {
    if (licenseKey) {
        LicenseManager.setLicenseKey(licenseKey);
        console.log('AG-Charts Enterprise license installed.');
    } else {
        console.warn('AG-Charts Enterprise license key not found. Please set VITE_AG_GRID_LICENSE_KEY in your .env file.');
    }
}
