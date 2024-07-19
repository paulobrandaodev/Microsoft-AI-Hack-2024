// Seleciona elementos do DOM
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureButton = document.querySelector('.capture');

// Função para capturar uma foto
function capturePhoto() {
    // Desenha o frame atual do vídeo em um canvas
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    // Converte o conteúdo do canvas em uma imagem base64
    const imageDataURL = canvas.toDataURL('image/png');

    // Cria um blob a partir da imagem base64
    const byteString = atob(imageDataURL.split(',')[1]);
    const mimeString = imageDataURL.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });

    // Envia o blob para o Blob Storage na Azure
    uploadToAzureBlobStorage(blob);
}

 // Função para enviar o blob para o Blob Storage na Azure
 function uploadToAzureBlobStorage(blob) {

    const accountName = 'lakeinfo';
    const sasToken = 'sp=racwle&st=2024-04-05T12:50:47Z&se=2024-04-05T20:50:47Z&spr=https&sv=2022-11-02&sr=c&sig=7KfyLZhh%2FZ%2Byk4BQ2%2B4ib9whj2HDHc4LUxdHUbj6oy0%3D';
    const containerName = 'bronze';

    // Cria a URL de acesso ao Blob Storage
    const blobUrl = `https://${accountName}.blob.core.windows.net/${containerName}/photo_${Date.now()}.png`;

    // Cria um objeto XMLHttpRequest
    const xhr = new XMLHttpRequest();

    // Define a operação HTTP como PUT
    xhr.open('PUT', `${blobUrl}?${sasToken}`, true);

    // Define o tipo de conteúdo como imagem PNG
    xhr.setRequestHeader('Content-Type', 'image/png');

    // Define o cabeçalho obrigatório x-ms-blob-type como BlockBlob
    xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');

    // Envia o blob
    xhr.send(blob);

    // Trata a resposta
    xhr.onload = function() {
        if (xhr.status === 201) {
            console.log('Foto enviada com sucesso para o Blob Storage.');
            // Após o upload bem-sucedido, chame a função que faz a requisição para o Custom Vision
            sendCustomVisionRequest(blobUrl);
            console.log(blobUrl);
        } else {
            console.error('Erro ao enviar para o Blob Storage:', xhr.responseText);
        }
    };

}

// Função para enviar o blob para o Blob Storage na Azure
// Verifica se o navegador suporta a API de mídia getUserMedia
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(stream) {
            // Exibe o stream de vídeo na tag <video>
            video.srcObject = stream;
        })
        .catch(function(error) {
            console.error('Erro ao acessar a câmera:', error);
        });
}

// Adiciona um ouvinte de eventos para o botão de captura
captureButton.addEventListener('click', capturePhoto);

// TTS
const ReproduzirVoz = (resposta) => {

    var myHeaders = new Headers();
    myHeaders.append("Ocp-Apim-Subscription-Key", "260de0888d04442a98b8cd0dba2ca875");
    myHeaders.append("Content-Type", "application/ssml+xml");
    myHeaders.append("X-Microsoft-OutputFormat", "audio-16khz-128kbitrate-mono-mp3");
    myHeaders.append("User-Agent", "curl");
    
    var raw = "<speak version='1.0' xml:lang='pt-BR'>\r\n    <voice xml:lang='pt-BR' xml:gender='Female' name='pt-BR-FranciscaNeural'>\r\n        "+resposta+"\r\n    </voice>\r\n</speak>";
    
    var requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: raw,
      redirect: 'follow'
    };
    
    fetch("https://eastus.tts.speech.microsoft.com/cognitiveservices/v1", requestOptions)
    .then(response => {
        if (response.ok) {
            return response.arrayBuffer();
        } else {
            throw new Error(`Falha na requisição: ${response.status} - ${response.statusText}`);
        }
    })
    .then(data => {
        const blob = new Blob([data], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);

        const audioElement = new Audio(audioUrl);
        audioElement.play();
    })
    .catch(error => {
        console.error('Erro:', error);
    });

}


// OPEN AI
// Criamos o método para consultar a API do OpenAI
const ConsultarOpenAI = (pergunta) => {

    openAIKey = "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";

    // Aqui vamos configurar o cabeçalho da requisição
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("api-key", "4e958ea7e8e24b7782ce5546f484d402");

    // Aqui vamos configurar o corpo da requisição
    var raw = JSON.stringify({
        "messages": [
            {
                "role": "system",
                "content": "Você é um assistente virtual que descreve o conteúdo de uma imagem para pessoas com deficiência ou dificuldades visuais. Escreva a resposta de uma maneira 'falada' para que seja lida por alguém."
            },
            {
                "role": "user",
                "content": "Uma certa foto mostrou os remédios para um serviço de IA: "+pergunta+" Como posso descrever este remédio para um usuário, nos casos onde a campo 'probability' for maior que 0.3, aproveite e descreva a porcentagem de acerto retornado pela IA somente daqueles medicamentos que deram uma porcentagem superior a 0.3, ignore os demais, sem falar o nome desses com porcentagem a baixo de 0.3"
            }
        ]
    });

    // Aqui vamos configurar o método da requisição
    var requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw
    };

    // Aqui vamos fazer a requisição
    fetch("https://openaiinfo-2.openai.azure.com/openai/deployments/gpt-35-turbo-16k/chat/completions?api-version=2024-03-01-preview", requestOptions)
    .then(response => response.json())
    .then(result => ReproduzirVoz(result.choices[0].message.content))
    .catch(error => console.log('error', error));
}

// Função para enviar uma requisição para o serviço Custom Vision da Azure
function sendCustomVisionRequest(imageUrl) {
    const predictionUrl = 'https://eastus.api.cognitive.microsoft.com/customvision/v3.0/Prediction/c11fb3c4-f880-4470-bd50-cc21a143f8b2/detect/iterations/Iteration1/url';
    const predictionKey = 'e0d85710c92444db9c3b3a9153537732';

    // Cria um objeto XMLHttpRequest
    const xhr = new XMLHttpRequest();

    // Define a operação HTTP como POST
    xhr.open('POST', predictionUrl, true);

    // Define o cabeçalho Prediction-Key
    xhr.setRequestHeader('Prediction-Key', predictionKey);

    // Define o cabeçalho Content-Type
    xhr.setRequestHeader('Content-Type', 'application/json');

    // Cria os dados da requisição
    const requestData = {
        url: imageUrl
    };

    // Envia os dados da requisição
    xhr.send(JSON.stringify(requestData));

    // Trata a resposta
    xhr.onload = function() {
        if (xhr.status === 200) {
            console.log('Resposta do serviço Custom Vision:', xhr.responseText);
            ConsultarOpenAI(xhr.responseText)
        } else {
            console.error('Erro na requisição para o serviço Custom Vision:', xhr.responseText);
        }
    };
}

//ConsultarOpenAI("Dipirona");