const axios = require('axios');

async function testRejectWebhook() {
    try {
        console.log('Fetching removal requests from MediConnect...');
        const res = await axios.get('http://localhost:5000/api/removal-requests');
        const requests = res.data;

        // Find a pending request
        const pendingReq = requests.find(r => r.status === 'Pending MediConnect Approval');

        if (!pendingReq) {
            console.log('No pending requests found. Creating a fake one in Hospital A for testing.');
            // Need to create one in Hospital A first
            const shareRes = await axios.post('http://localhost:8001/api/removal-requests', {
                patientIds: ['1_A'] // Just using an existing patient id
            });
            console.log('Created request in Hospital A:', shareRes.data);

            // Wait for async processing or just proceed to approve it locally
            // Assuming we get the ID from the response or we just fetch from Hospital A
            const hospReqList = await axios.get('http://localhost:8001/api/removal-requests');
            const hospReq = hospReqList.data.find(r => r.status === 'Pending Hospital Approval' && r.patientId === '1_A');

            if (hospReq) {
                console.log(`Approving request ${hospReq._id} in Hospital A to forward to MediConnect...`);
                await axios.put(`http://localhost:8001/api/removal-requests/${hospReq._id}/approve`);
                console.log('Forwarded to MediConnect.');
            }
            return testRejectWebhook(); // retry
        }

        console.log(`Found pending request in MediConnect: ${pendingReq._id}`);
        console.log('Rejecting it...');

        const rejectRes = await axios.put(`http://localhost:5000/api/removal-requests/${pendingReq._id}/reject`);
        console.log('MediConnect reject response:', rejectRes.data);

        // Check Hospital A's status
        console.log('Waiting 1s for webhook to process...');
        await new Promise(r => setTimeout(r, 1000));

        const hospReqsRes = await axios.get('http://localhost:8001/api/removal-requests');
        const hospReq = hospReqsRes.data.find(r => r.patientId === pendingReq.hospitalPatientId || r.patientId === pendingReq.patientId);

        console.log(`Hospital A status for patient ${hospReq ? hospReq.patientId : 'unknown'}:`, hospReq ? hospReq.status : 'not found');

    } catch (error) {
        console.error('Test failed:', error.response ? error.response.data : error.message);
    }
}

testRejectWebhook();
