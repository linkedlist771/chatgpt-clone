
   
//    function navigateToPage(apiKey) {
//     // Placeholder for navigation
//     var baseUrl = 
  
//     // 构建目标页面的完整URL
//     var targetUrl = baseUrl + '/claude/chat' + '?api_key=' + apiKey;
  
//     // 跳转到目标页面
//     console.log('Navigating to:', targetUrl);
//     window.location.href = targetUrl;

// }
const targetURLBase = window.location.protocol + '//' + window.location.host + '/claude/chat';

function getQueryParam(key) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(key);
  }

function readAPIKey() {
apiKey = localStorage.getItem('SJ_API_KEY');
//  alert(apiKey);
    if (apiKey == null || apiKey == undefined || apiKey == "null" || apiKey == "undefined")  {
    apiKey = getQueryParam('api_key');
    localStorage.setItem('SJ_API_KEY', apiKey);
    }
    console.log(`API Key: ${apiKey}`);
}







    // Function to create a card
    function createCard(cardData) {
        const card = document.createElement('div');
        card.className = 'card';

        const title = document.createElement('h2');
        title.textContent = cardData.id;

        const status = document.createElement('div');
        status.className = 'status';
        status.textContent = cardData.status;
        // if  active, then color green , if error then red
        if (cardData.status === "active") {
            status.style.color = "green";
        }
        else if (cardData.status === "error") {
            status.style.color = "red";
        }

        const chineseStatus = document.createElement('div');
        chineseStatus.className = 'chineseStatus';
        chineseStatus.textContent = "状态: 可用";

        const plus = document.createElement('div');
        plus.className = cardData.type.toLowerCase();
        plus.textContent = cardData.type.toUpperCase();

        card.appendChild(plus);
        card.appendChild(title);
        card.appendChild(status);
        card.appendChild(chineseStatus);

        // 能不能给card添加一个属性? idx = 
        card.setAttribute('idx', cardData.idx);
            // Add click event listener to navigate to a URL specified in cardData
        card.addEventListener('click', () => {
            const targetURL = targetURLBase + '?api_key=' + apiKey + '&client_idx=' + cardData.idx + '&client_type=' + cardData.type;
            window.location.href = targetURL;
        });

        return card;
    }


    async function rendererCard(cardDataPromise) {
        const container = document.getElementById('container');
        const loadingDiv = document.getElementById('loading') || document.createElement('div');
        if (!loadingDiv.id) {
            loadingDiv.id = 'loading';
            loadingDiv.textContent = '加载中...';
            container.appendChild(loadingDiv);
        }
        
        try {
            const cardData = await cardDataPromise; // Wait for the promise to resolve
            console.log(cardData);
            
            // Remove existing cards (optional: clear previous results)
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
            
            for (const data of cardData) {
                container.appendChild(createCard(data));
            }
        } catch (error) {
            console.error('Failed to load card data:', error);
            loadingDiv.textContent = '加载失败，请重试。';
        } finally {
            // Hide or remove the loading message
            loadingDiv.style.display = 'none';
        }
    }
    
    
    const baseURL = "https://claude3.edu.cn.ucas.life";
    const route = "/api/v1"; // client_status
    const apiKeyUrl = baseURL + route;
    
    async function sendRequest(url, method, queryParams = null, body = null) {
        url = apiKeyUrl + url;
        if (queryParams) {
            url += '?' + new URLSearchParams(queryParams).toString();
        }
        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: body ? JSON.stringify(body) : undefined
            });
            return response.json(); // Return the parsed JSON data
        } catch (error) {
            console.error('Error:', error);
        }
    }
    
    async function getClientsStatus() {
        const cardDataPromise = sendRequest('/clients_status', 'GET');
        rendererCard(cardDataPromise); // Pass the promise to the renderer
    }
    
    document.addEventListener('DOMContentLoaded', function() {
        const container = document.getElementById('container');
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading';
        loadingDiv.textContent = '加载中...';
        // bold font , 30 px
        loadingDiv.style.fontWeight = 'bold';
        loadingDiv.style.fontSize = '30px';
        container.appendChild(loadingDiv);
        readAPIKey();
        getClientsStatus();
    });
    