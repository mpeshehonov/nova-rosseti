import * as THREE from './node_modules/three/build/three.module.js';
import {GLTFLoader} from './node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {FBXLoader} from './node_modules/three/examples/jsm/loaders/FBXLoader.js'
import {PointerLockControls} from './node_modules/three/examples/jsm/controls/PointerLockControls.js';
import {TransformControls} from './node_modules/three/examples/jsm/controls/TransformControls.js';
import {Octree} from './node_modules/three/examples/jsm/math/Octree.js';
import {Capsule} from './node_modules/three/examples/jsm/math/Capsule.js';

const clock = new THREE.Clock();
const gravity = 30;
const worldOctree = new Octree(); // мир, объекты кот. ему принадлеж-е взаимод-ет между собой
const playerCollider = new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1, 0), 0.35); // область игрока для рег-ии столк-й будет капсула
let playerVelocity = new THREE.Vector3(); // вектор скорости игрока
const playerDirection = new THREE.Vector3(); // вектор направления игрока
let playerOnFloor = false; // нахождение капсулы игрока на физ. теле сцены
let speedAccelOn = false; // бег

let prevTime = performance.now();
const redButtons = []; // массив redButtons для теста
let raycaster;
let raycasterColor;
var raycasterAvia = new THREE.Raycaster(); // для центровки загруженных моделей в камере
var mouseCoords = new THREE.Vector2(); // для координаты центровки объектов в камере

// for animation:
var mixer;
var mixers = [];

// for transform manipulate:
let control, orbit;
let selectedObject = null;
let group; // исп. для детекции и манипуляции
let groupRemote; // группа деталей пульта ДУ

let startSaltoR = false;	// сальто боковое правое (крен правый)
let startSaltoL = false;	// сальто боковое левое (крен левый)

let audio = new Audio('./audio/coin.mp3');
init();

// Счётчик очков
var pointCount = 0;

function init() {
    // Scene -------------------------#################--------------------------------------------------------
    const scene = new THREE.Scene();
    //	scene.background = new THREE.Color( 0xbfd1e5 );

    // camera:
    let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200000);
    camera.position.set(-14, 8, 16);
    camera.rotation.order = 'YXZ'; // от шутана оф

    // controls:
    let controls = new PointerLockControls(camera, document.body);
    raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10); // вектор для проецирования лучей для джампад
    raycasterColor = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 50); // вектор для проецирования лучей по определению объектов по цветам посл. параметр - длина луча

    const canvas = document.getElementById('blocker');
    // size window canvas 3d:
//	window.innerWidth = 2000; // изначальные пропорции 3d 
//	window.innerHeight = 1000;

    // Render & Controls ---------------####################-------------------------------------------
    const renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap; // св-во полутени (гладко, но не работает с physicallyCorrectLights)
    renderer.physicallyCorrectLights = true; // доп коррекция ( не будут видны карты теней если вкл)
    renderer.outputEncoding = THREE.sRGBEncoding;
//	renderer.toneMapping = THREE.ReinhardToneMapping;


    const container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(renderer.domElement);

    window.addEventListener('resize', () => { // окно при ресайзе должно сохранять пропорции
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }, false);


    // Menu -------------------------##########################---------------------------------------------
    menu(); // отображение менюшки
    function menu() {
        instructions.addEventListener('click', funtets); // переписал функцию из выражения
        function funtets() {
            controls.lock();
        }

        controls.addEventListener('lock', function () { // отображение инстр. при play
            instructions.style.display = 'none';
            canvas.style.display = 'none';
        });
        controls.addEventListener('unlock', function () {
            canvas.style.display = 'block';
            instructions.style.display = '';
        });

        scene.add(controls.getObject());
    }


    document.addEventListener('click', () => { // выстрел по клику
        const sphere = spheres[sphereIdx];
        camera.getWorldDirection(playerDirection);
        sphere.collider.center.copy(playerCollider.end);
        sphere.velocity.copy(playerDirection).multiplyScalar(180);
        sphereIdx = (sphereIdx + 1) % spheres.length;
    }, false);


    // crosshair  -------------------------#################-------------------------------------------
    //  crosshair:
    var materialCrsh = new THREE.LineBasicMaterial({color: 0xAAFFAA});
    // crosshair size
    var x = 0.0025, y = 0.0025;
    var geometryCroshair = new THREE.Geometry();
    // crosshair
    geometryCroshair.vertices.push(new THREE.Vector3(0, y, 0));
    geometryCroshair.vertices.push(new THREE.Vector3(0, -y, 0));
    geometryCroshair.vertices.push(new THREE.Vector3(0, 0, 0));
    geometryCroshair.vertices.push(new THREE.Vector3(x, 0, 0));
    geometryCroshair.vertices.push(new THREE.Vector3(-x, 0, 0));
    //
    var crosshair = new THREE.Line(geometryCroshair, materialCrsh);
    // place it in the center
    var crosshairPercentX = 50;
    var crosshairPercentY = 50;
    var crosshairPositionX = (crosshairPercentX / 100) * 2 - 1;
    var crosshairPositionY = (crosshairPercentY / 100) * 2 - 1;
    //
    crosshair.position.x = crosshairPositionX * camera.aspect;
    crosshair.position.y = crosshairPositionY;
    crosshair.position.z = -0.3;
    camera.add(crosshair);


    // солнце
    const directionalLight = new THREE.DirectionalLight('#FFFFFF', 0.001); // 0xffffaa
    directionalLight.position.set(-5, 25, -1);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.01;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.radius = 4;
    directionalLight.shadow.bias = -0.00006;
    scene.add(directionalLight);


    // спец освещение для неба
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.86);
    hemiLight.color.setHSL(0.6, 1, 0.6);
    hemiLight.groundColor.setHSL(0.095, 1, 0.75);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);


    //	scene.fog = new THREE.Fog( 0xa0a0a0, 100, 700 ); // белый 0xffffff
    scene.fog = new THREE.Fog(0xffffff, 100, 700); // белый 0xffffff
    let nearFog = 20;
    scene.fog.near = nearFog;
    let farFog = 600;
    scene.fog.far = farFog;


    // SKYDOME
    const vertexShader = document.getElementById('vertexShader').textContent;
    const fragmentShader = document.getElementById('fragmentShader').textContent;
    const uniforms = {
        "topColor": {value: new THREE.Color(0x0077ff)}, // 0x6688cc  0x0077ff
        "bottomColor": {value: new THREE.Color(0xffffff)}, // 0x01021C  0xffffff
        "offset": {value: 2},
        "exponent": {value: 0.6}
    };
    uniforms["topColor"].value.copy(hemiLight.color);
    //
    const skyGeo = new THREE.SphereGeometry(4000, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.BackSide
    });
    //
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);


// объекты для манипуляци трансформации: --------------------------------------------------------
    // объекты:
    group = new THREE.Group();
    group.name = "projectors";
    scene.add(group);

    // make cubes for transf manipulate:
    let geometry1 = new THREE.BoxBufferGeometry(2, 1, 2);
    let object1 = new THREE.Mesh(geometry1, new THREE.MeshLambertMaterial({color: '#69f'}));
    object1.position.set(-45, 0, 0);
    object1.castShadow = true;
    scene.add(object1);
    group.add(object1);


    // make cubes for transf manipulate:
    let geom1cub = new THREE.BoxBufferGeometry(2, 1, 2);
    let objectcub = new THREE.Mesh(geom1cub, new THREE.MeshLambertMaterial({color: '#69f'}));
    objectcub.position.set(-50, 0, 0);
    objectcub.castShadow = true;
    scene.add(objectcub);
    group.add(objectcub);


// прожекторы:
    // projectors for for transf manipulate:
    let flashLightT1, spotLightT1;
    flashLightT1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 20), new THREE.MeshPhongMaterial({color: '#330099'}));
    flashLightT1.rotateX(Math.PI / 2);
    spotLightT1 = new THREE.SpotLight(0xffffff, 0.5, 150);
    spotLightT1.power = 100.5;
    spotLightT1.angle = 0.5;
    spotLightT1.decay = 2;
    spotLightT1.penumbra = 0.1;
    spotLightT1.distance = 200;
    spotLightT1.rotateX(Math.PI / 2);
    spotLightT1.shadow.camera.near = 0.01;
    spotLightT1.shadow.camera.far = 500;
    spotLightT1.shadow.camera.right = 30;
    spotLightT1.shadow.camera.left = -30;
    spotLightT1.shadow.camera.top = 30;
    spotLightT1.shadow.camera.bottom = -30;
    spotLightT1.shadow.mapSize.width = 1024;
    spotLightT1.shadow.mapSize.height = 1024;
    flashLightT1.add(spotLightT1);
    flashLightT1.add(spotLightT1.target);
    flashLightT1.position.set(0, 2, 0);
    flashLightT1.rotation.set(0, 2, 0);
    scene.add(flashLightT1);
    group.add(flashLightT1);
    flashLightT1.castShadow = true;


    // Добавляем рандомно красные квадраты для прохождения
    for (let i = 0; i < 100; i++) {
        var redSquare = new THREE.Mesh(
          new THREE.CylinderGeometry( 0.5, 0.5, 0.1, 32),
          new THREE.MeshLambertMaterial({color: 'yellow'}));
        scene.add(redSquare);
        redSquare.position.set(
          Math.floor(Math.random()*300),
          Math.floor(Math.random()*100),
          Math.floor(Math.random()*300)); // 75, 4, 16.5
        redSquare.castShadow = true;
        redSquare.rotation.x = Math.PI / 2;
        redSquare.rotation.y = Math.PI / 4;
        redButtons.push(redSquare);
    }

    function touchRedButton() { 	// можно использовать как прохождение трассы, или напротив- ошибка, если было касание
        raycaster.ray.origin.copy(controls.getObject().position);
        raycaster.ray.origin.y > 0.1 || raycaster.ray.origin.y < 0.1; // реагирование на пересечение игрока с объектом по вертикали
        raycaster.ray.origin.x > 0;
        raycaster.ray.origin.z > 0;
        const pointCounterWrapper = document.querySelector('.point-counter-wrapper');

        let intersections = raycaster.intersectObjects(redButtons);
        let onObject = intersections.length > 0; // реагирование с принадлежащим объектом из массива объектов- onObject
        for (let i = 0; i < intersections.length; i++) {
            const touchedSquare = intersections[i];
            let yPointIntersect = touchedSquare.point.y;
            if ( onObject === true  ) {
                audio.play();
                pointCount = pointCount + 1;
                touchedSquare.object.material.color.set('#FF33FF');
                touchedSquare.object.scale.set(0.2, 0.2, 0.2);
                touchedSquare.object.rotation.set(30, 0, 0);
                pointCounterWrapper.innerHTML = pointCount;
            } else {
                touchedSquare.object.material.color.set('#f00');
            }
        }

    };


//переключения контроллов:-------------------------------------------------------------------
    // keys: change controls:1,2,3
    let onKeyDown = function (event) {
        switch (event.keyCode) {
            case 49: // 1
                let aFlag = 1;
                activcontr(aFlag); // включить PointerControl
                break;

            case 50: // 2
                let bFlag = 2;
                activcontr(bFlag); // включить  Transformcontrol
                break;
        }
    };
    document.addEventListener('keydown', onKeyDown, false);


    function activcontr(a) {
        if (a == 1) {
            scene.remove(control);
            scene.remove(controls);
            delCtrols();
            activateDetectorObectsScene(false);
            raycasterColor = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 0); // применили к лучу детекции короткую длину -0 в конце вектора
            controls = new PointerLockControls(camera, document.body); // включаем игровой контроль от первого лица
            //	camera.rotation.order = 'YXZ'; // от шутана оф
            controls.enableRotate = true;
        } else if (a == 2) { //
            scene.remove(control);
            scene.remove(controls);
            delCtrols();
            activateDetectorObectsScene(true);
            raycasterColor = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 50);
            control = new TransformControls(camera, document.body, renderer.domElement);
            scene.add(control);
            controls.enableRotate = true;
            document.addEventListener('keydown', function (event) {
                switch (event.keyCode) {
                    case 84: // T
                        control.setMode("translate");
                        break;
                    case 85: // U
                        control.setMode("rotate");
                        break;
                    case 89: // Y
                        control.setMode("scale");
                        break;
                    case 73: // I
                        control.enabled = !control.enabled;
                        break;
                }
            });
        }


        const mouse = new THREE.Vector2(); // создается двухмерный вектор по умолчанию что будет в качестве объекта для детекции служить, а не курсор


        // детектор объектов:----------------------------------------------------

        function activateDetectorObectsScene(flag) {
            if (flag == true) {
                document.addEventListener('pointermove', onPointerMove);
            } else if (flag == false) {
                document.addEventListener('pointermove', offPointerMove);
            }

            function onPointerMove(event) {
                if (selectedObject) {
                    //	selectedObject.material.color.set( '#69f' ); // если выделенный объект имеет данный цвет в св-х
                    selectedObject.parent.name = "projectors"; // если выдленный объект имеет св-во по родителю "cubiks"
                    control.attach(selectedObject); // если выделили объект, то ему присвоим контрллер control.attach( selectedObject );
                    selectedObject = null;
                }

                raycasterColor.setFromCamera(mouse, camera); // включается при пересечении с прицелом ( двухмерным вектором мышки)

                const intersectsColor = raycasterColor.intersectObject(group, true);
                if (intersectsColor.length > 0) {
                    const res = intersectsColor.filter(function (res) {
                        return res && res.object;
                    })[0];
                    if (res && res.object) {
                        selectedObject = res.object;
                        selectedObject.material.color.set('#FF33FF');  // '#f00'
                    }
                }
            }

            function offPointerMove() {// переписать на более удобную ф. с возвратом родного любого цвета
                if (selectedObject) {
                    selectedObject.parent.name = "projectors";
                    control.attach(selectedObject);
                    selectedObject = null;
                }
                const intersectsColor = raycasterColor.intersectObject(group, true);
                if (intersectsColor.length > 0) {
                    const res = intersectsColor.filter(function (res) {
                        return res && res.object;
                    })[0];
                    if (res && res.object) {
                        selectedObject = res.object;
                        selectedObject.material.color.set('#330099');
                    }
                }
            }

        }


    }


// Мувинг:----------------------------------------------------------------		
    // кнопки и направления по мувингу
    function getForwardVector() { // вперед-назад
        camera.getWorldDirection(playerDirection);
        playerDirection.y = 0;
        playerDirection.normalize();
        return playerDirection;
    }

    function getSideVector() { // движение в сторону
        camera.getWorldDirection(playerDirection);
        playerDirection.y = 0;
        playerDirection.normalize();
        playerDirection.cross(camera.up);
        return playerDirection;
    }

    function movingfunction(deltaTime) { // отдельно ф-я передана в анимацию для перерисовки по кадрам
        let speed = 285;
        if (playerOnFloor == true) {
            if (keyStates['KeyW']) {
                playerVelocity.add(getForwardVector().multiplyScalar(speed * deltaTime));
            }
            if (keyStates['KeyS']) {
                playerVelocity.add(getForwardVector().multiplyScalar(-speed * deltaTime));
            }
            if (keyStates['KeyA']) {
                playerVelocity.add(getSideVector().multiplyScalar(-speed * deltaTime));
            }
            if (keyStates['KeyD']) {
                playerVelocity.add(getSideVector().multiplyScalar(speed * deltaTime));
            }
            if (keyStates['Space']) {
                playerVelocity.y = 15;
            }
            if (keyStates['KeyX']) {
                playerVelocity.y -= 35;
            }
            if (keyStates['KeyC']) {
                playerVelocity.y -= 35;
            }
        }

        /* вставка для индикаторов */

        /* индикатор крена */
        const rollMark = document.getElementById("roll-mark");
        const airplaneRollView = document.getElementById("airplane-roll-view");

        rollMark.innerText = ((180 / Math.PI) * camera.rotation.z).toFixed(0) < 360
            ? ((180 / Math.PI) * camera.rotation.z).toFixed(0)
            : ((180 / Math.PI) * camera.rotation.z).toFixed(0) - 360;
        airplaneRollView.style.transform = 'rotate(' + (180 / Math.PI) * camera.rotation.z + 'deg)';

        /* индикатор крена */
        const pitchMark = document.getElementById("pitch-mark");
        const airplanePitchView = document.getElementById("airplane-pitch-view");

        pitchMark.innerText = ((180 / Math.PI) * camera.rotation.x).toFixed(0) < 360
            ? ((180 / Math.PI) * camera.rotation.x).toFixed(0)
            : ((180 / Math.PI) * camera.rotation.x).toFixed(0) - 360;
        airplanePitchView.style.transform = 'rotate(' + (180 / Math.PI) * camera.rotation.x + 'deg)';


        // console.dir(camera.rotation.z);
        /* индикаторы горизонтальной скорости */
        const hSpeedMark = document.getElementById("h-speed-mark");
        hSpeedMark.innerText = Math.sqrt((parseFloat(playerVelocity.x)) ** 2 + (parseFloat(playerVelocity.z)) ** 2).toFixed(1);
        const hSpeedView = document.getElementById("h-speed-arrow");
        hSpeedView.style.transform = 'rotate(' + (-30 + +Math.sqrt((parseFloat(playerVelocity.x)) ** 2 + (parseFloat(playerVelocity.z)) ** 2).toFixed(1)) + 'deg)';

        /* индикатор вертикальной скорости */
        const vSpeedValueBox = document.getElementById("v-speed-value");
        vSpeedValueBox.innerText = (playerVelocity.y).toFixed(1);
        /* поправки */
        let nearestSpeedDiv = document.getElementsByClassName('v-speed-nearest-value'); /* массив div-ов с ближайшими скоростями */
        for (let i = 0; i < nearestSpeedDiv.length; i++) {
            nearestSpeedDiv[i].innerHTML = (playerVelocity.y - 0.4 + 0.1 * i).toFixed(1);
        }

        /* индикатор высоты */
        const heightValueBox = document.getElementById("height-value");
        heightValueBox.innerText = (camera.position.y).toFixed(1);
        /* поправки */
        let nearestHeightDiv = document.getElementsByClassName('height-nearest-value'); /* массив div-ов с ближайшими высотами */
        for (let i = 0; i < nearestHeightDiv.length; i++) {
            nearestHeightDiv[i].innerHTML = (camera.position.y - 0.4 + 0.1 * i).toFixed(1);
        }

        /* компасс */
        const compassScale = document.querySelector('.compass .scale');
        compassScale.style.transform = 'rotate(' + (180 / Math.PI) * camera.rotation.y + 'deg)';

    }

    function movingfunctionAir(deltaTime) { //  мувинг без коллизий с объектами физ мира, пока гирок в полете
        let speedaAir = 65;
        if (playerOnFloor == false) {
            if (keyStates['KeyW']) {
                playerVelocity.add(getForwardVector().multiplyScalar(speedaAir * deltaTime));
            }
            if (keyStates['KeyS']) {
                playerVelocity.add(getForwardVector().multiplyScalar(-speedaAir * deltaTime));
            }
            if (keyStates['KeyA']) {
                playerVelocity.add(getSideVector().multiplyScalar(-speedaAir * deltaTime));
            }
            if (keyStates['KeyD']) {
                playerVelocity.add(getSideVector().multiplyScalar(speedaAir * deltaTime));
            }
            if (keyStates['Space']) {
                playerVelocity.y = 15;
            }
            if (keyStates['KeyX']) {
                playerVelocity.y = -35
            }
            if (keyStates['KeyC']) {
                playerVelocity.y = -35
            }

        }

    }


// прослушиватели событий для мувинга: ------
    const keyStates = {};

    document.addEventListener('keydown', (event) => {
        keyStates[event.code] = true;
    }, false);

    document.addEventListener('keyup', (event) => {
        keyStates[event.code] = false;
        playerVelocity.z = 0 //  без заноса
        playerVelocity.y = 0 //  без заноса
        playerVelocity.x = 0 //  без заноса
    }, false);


    //  присест свойства капсулы игрока
    let onKeyDownSit = function (event) {
        switch (event.keyCode) {
            case 17: // ctrl
                playerCollider.radius = 0.15;
                break;
        }
    };
    let onKeyUpSit = function (event) {
        switch (event.keyCode) {
            case 17: // ctrl
                playerCollider.radius = 0.85;
                break;
        }
    };
    document.addEventListener('keydown', onKeyDownSit, false);
    document.addEventListener('keyup', onKeyUpSit, false);


    // бег - ускорение
    let onKeyDownAccel = function (event) {
        switch (event.keyCode) {
            case 16: // shift
                speedAccelOn = true;
                break;
        }
    };
    let onKeyUpAccel = function (event) {
        switch (event.keyCode) {
            case 16: // shift
                speedAccelOn = false;
                break;
        }
    };
    document.addEventListener('keydown', onKeyDownAccel, false);
    document.addEventListener('keyup', onKeyUpAccel, false);


    function moveshift(deltaTime) {	//  ускорение когда на земле
        let speedshift = 385;
        if (speedAccelOn == true && playerOnFloor == true) {
            if (keyStates['KeyW']) {
                playerVelocity.add(getForwardVector().multiplyScalar(speedshift * deltaTime));
            }
            if (keyStates['KeyS']) {
                playerVelocity.add(getForwardVector().multiplyScalar(-speedshift * deltaTime));
            }
            if (keyStates['KeyA']) {
                playerVelocity.add(getSideVector().multiplyScalar(-speedshift * deltaTime));
            }
            if (keyStates['KeyD']) {
                playerVelocity.add(getSideVector().multiplyScalar(speedshift * deltaTime));
            }
            if (keyStates['Space']) {
                playerVelocity.y = 35;
            }
            if (keyStates['KeyX']) {
                playerVelocity.y = -35
            }
            if (keyStates['KeyC']) {
                playerVelocity.y = -35
            }
        }
    }

    function moveshiftonAir(deltaTime) {	//  ускорение когда в полете
        let speedshift = 165;
        if (speedAccelOn == true && playerOnFloor == false) {
            if (keyStates['KeyW']) {
                playerVelocity.add(getForwardVector().multiplyScalar(speedshift * deltaTime));
            }
            if (keyStates['KeyS']) {
                playerVelocity.add(getForwardVector().multiplyScalar(-speedshift * deltaTime));
            }
            if (keyStates['KeyA']) {
                playerVelocity.add(getSideVector().multiplyScalar(-speedshift * deltaTime));
            }
            if (keyStates['KeyD']) {
                playerVelocity.add(getSideVector().multiplyScalar(speedshift * deltaTime));
            }
            if (keyStates['Space']) {
                playerVelocity.y = 35;
            }
            if (keyStates['KeyX']) {
                playerVelocity.y = -35
            }
            if (keyStates['KeyC']) {
                playerVelocity.y = -35
            }
        }
    }


    // зависание в воздухе беспилотника
    let on = function (event) {
        switch (event.keyCode) {
            case 70: // f
                requestAnimationFrame(frozen);
                break;
        }
    };
    document.addEventListener('keydown', on, false);

    function frozen() {
        playerVelocity.set(0, 0, 0);
    }


    //  сальто правое (крен правый)
    let onKeyDownSaltoR = function (event) {
        switch (event.keyCode) {
            case 69: // e
                startSaltoR = true;
                break;
        }
    };
    let onKeyUpSaltoR = function (event) {
        switch (event.keyCode) {
            case 69: // e
                startSaltoR = false;
                camera.rotation.z = Math.PI * 2;
                break;
        }
    };
    document.addEventListener('keydown', onKeyDownSaltoR, false);
    document.addEventListener('keyup', onKeyUpSaltoR, false);

    function moveSaltoRight(deltaTime) {	// тестовая по дефолту камера имеет положение 0 градусов ли 360
        let speedshift = 65;
        if (startSaltoR == true) {
            camera.rotation.z += Math.PI / 40;
            if (keyStates['KeyW']) {
                playerVelocity.add(getForwardVector().multiplyScalar(speedshift * deltaTime));
            }
            if (keyStates['KeyS']) {
                playerVelocity.add(getForwardVector().multiplyScalar(-speedshift * deltaTime));
            }
            if (keyStates['KeyA']) {
                playerVelocity.add(getSideVector().multiplyScalar(-speedshift * deltaTime));
            }
            if (keyStates['KeyD']) {
                playerVelocity.add(getSideVector().multiplyScalar(speedshift * deltaTime));
            }
        }
    }


    //  сальто леове (крен левый)
    let onKeyDownSaltoL = function (event) {
        switch (event.keyCode) {
            case 81: // w
                startSaltoL = true;
                break;
        }
    };
    let onKeyUpSaltoL = function (event) {
        switch (event.keyCode) {
            case 81: // q
                startSaltoL = false;
                camera.rotation.z = Math.PI * 2;
                break;
        }
    };
    document.addEventListener('keydown', onKeyDownSaltoL, false);
    document.addEventListener('keyup', onKeyUpSaltoL, false);

    function moveSaltoLeft(deltaTime) {	// тестовая по дефолту камера имеет положение 0 градусов ли 360
        let speedshift = 65;
        if (startSaltoL == true) {
            camera.rotation.z -= Math.PI / 40;
            if (keyStates['KeyW']) {
                playerVelocity.add(getForwardVector().multiplyScalar(speedshift * deltaTime));
            }
            if (keyStates['KeyS']) {
                playerVelocity.add(getForwardVector().multiplyScalar(-speedshift * deltaTime));
            }
            if (keyStates['KeyA']) {
                playerVelocity.add(getSideVector().multiplyScalar(-speedshift * deltaTime));
            }
            if (keyStates['KeyD']) {
                playerVelocity.add(getSideVector().multiplyScalar(speedshift * deltaTime));
            }
        }
    }


//////////////////////
///---Indicators---///
//////////////////////

    /*
        // работа с выводом в поля индикаторы:
        // гипотеза вывода скорости
        function kfix(nur) {
            return nur.toFixed(10)
        }; // округляет до 1-ой десятой
        function delta(v1, v2) {
            var delta = Math.max(v1) - Math.min(v2);
            return (delta);
        } // функция диапазон: поле значений диапазон между максиумом и минимумом

        function accelPrint(deltaTime) { //  передать знаение скорости , округлить и разделить
            let speedGorund = 285;
            let speedaAir = 65;
            let speedshiftGround = 385;
            let speedshiftAir = 165;

            if (playerOnFloor == true) {
                let a = ((speedGorund / deltaTime) * 10);
                rezVizual(a);
            }
            if (playerOnFloor == false) {
                let b = ((speedaAir / deltaTime) * 10);
                rezVizual(b);
            }
            if (speedAccelOn == true && playerOnFloor == true) {
                let d = ((speedshiftGround / deltaTime) * 10);
                rezVizual(d);
            }
            if (speedAccelOn == true && playerOnFloor == false) {
                let e = ((speedshiftAir / deltaTime) * 10);
                rezVizual(e);
            }
        }

        // Передача данных в индикаторы:
        function rezVizual(a) {
            let rezume1 = document.getElementById('r2f');// поле для вывода
            rezume1.value = kfix(a);
        }
    */
    /*
    function playerPos( deltaTime ){ //  передать знаение скорости
    let plx = playerVelocity.x;
    let ply = playerVelocity.y;
    let plz = playerVelocity.z;
    rezVizualPos(plx,ply,plz);
    }

    // Передача данных в индикаторы:
    function rezVizualPos(a){
    let rezume1 = document.getElementById('r2f');// поле для вывода
    rezume1.value = a;
    }

    */


//////////////////////
///--- 3d city ----///
//////////////////////


// предметы - объекты на сцене
    // ground
    var meshground = new THREE.Mesh(new THREE.PlaneBufferGeometry(2000, 2000), new THREE.MeshPhongMaterial({
        color: 'green',
        depthWrite: false
    }));
    meshground.receiveShadow = true;
    meshground.rotation.x = -Math.PI / 2;
    meshground.castShadow = true;
    meshground.position.set(0, -0.1, 0);
    scene.add(meshground);
    worldOctree.fromGraphNode(meshground); // загруженную плоскость связываем с физ. миром, что детектить столкновения

    var grid = new THREE.GridHelper(2000, 30, 0x000000, 0x000000);
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    grid.position.set(0, -0.1, 0);
    scene.add(grid);


    var loaderLocation = new GLTFLoader();

    loaderLocation.load('./3d/models/avia_scene/location/3one02.glb', function (gltf) {
        scene.add(gltf.scene);
        worldOctree.fromGraphNode(gltf.scene);
        gltf.scene.castShadow = true;
    },);


    loaderLocation.load('./3d/models/avia_scene/location/3one03.glb', function (gltf) {
        scene.add(gltf.scene);
        worldOctree.fromGraphNode(gltf.scene);
        gltf.scene.castShadow = true;
    },);

    loaderLocation.load('./3d/models/avia_scene/location/3one04.glb', function (gltf) {
        scene.add(gltf.scene);
        worldOctree.fromGraphNode(gltf.scene);
        gltf.scene.castShadow = true;
    },);

    loaderLocation.load('./3d/models/avia_scene/location/3one06.glb', function (gltf) {
        scene.add(gltf.scene);
        worldOctree.fromGraphNode(gltf.scene);
        gltf.scene.castShadow = true;
    },);

    loaderLocation.load('./3d/models/avia_scene/location/3one07.glb', function (gltf) {
        scene.add(gltf.scene);
        worldOctree.fromGraphNode(gltf.scene);
        gltf.scene.castShadow = true;
    },);


// загрузка дронов во вьюпорт:
    let changeView1 = function (event) {
        switch (event.keyCode) {
            case 56: // 8
                camera.children[1].visible = false;
                camera.children[2].visible = true;
                break;

            case 57: // 9
                camera.children[1].visible = true;
                camera.children[2].visible = false;
                break;
        }
    };
    document.addEventListener('keydown', changeView1, false);


    var loader1 = new GLTFLoader();

    raycasterAvia.setFromCamera(mouseCoords, camera);
    let rayX = raycasterAvia.ray.direction.x;
    let rayY = raycasterAvia.ray.direction.y;
    let rayZ = raycasterAvia.ray.direction.z;

    loader1.load('./3d/models/avia_scene/drons/avia1bi.glb', function (gltf) {
        scene.add(gltf.scene);
        gltf.scene.scale.set(0.1, 0.1, 0.1);
        gltf.scene.position.set(0, 0, 0);
        gltf.scene.castShadow = true;
        let avia = gltf.scene;
        camera.add(avia);
//	avia.rotateY(Math.PI/2);
        avia.castShadow = true;
        avia.position.set(rayX + 0, rayY - 0.45, rayZ - 0.005);
        avia.visible = false;
    },);

    loader1.load('./3d/models/avia_scene/drons/dron1bi.glb', function (gltf) {
        scene.add(gltf.scene);
        gltf.scene.scale.set(0.1, 0.1, 0.1);
        gltf.scene.position.set(0, 0, 0);
        gltf.scene.castShadow = true;
        let avia = gltf.scene;
        camera.add(avia);
//	avia.rotateY(Math.PI/2);
        avia.castShadow = true;
        avia.position.set(rayX + 0, rayY - 0.65, rayZ - 0.002);
//	avia.visible = false;
    },);


/////////////////
///---Remote--///
/////////////////

// тестовое загрузить пульт ДУ и улавливать события:

    var loaderLocation = new GLTFLoader();
    groupRemote = new THREE.Group();
    groupRemote.name = "remoteDetails";
    scene.add(groupRemote);

    loaderLocation.load('./3d/models/avia_scene/remote/up2.glb', function (gltf) {
        let arrow1 = gltf.scene;
        gltf.scene.scale.set(0.5, 0.5, 0.5);
        scene.add(arrow1);
        groupRemote.add(arrow1);
        camera.add(arrow1);
        arrow1.rotateX(Math.PI / 2);
        arrow1.rotateY(Math.PI / 2);
        arrow1.position.set(rayX - 0.85, rayY - 0.52, rayZ - 0.0002);
    },);

    loaderLocation.load('./3d/models/avia_scene/remote/down2.glb', function (gltf) {
        let arrow1 = gltf.scene;
        gltf.scene.scale.set(0.5, 0.5, 0.5);
        scene.add(arrow1);
        groupRemote.add(arrow1);
        camera.add(arrow1);
        arrow1.rotateX(Math.PI / 2);
        arrow1.rotateY(Math.PI / 2);
        arrow1.position.set(rayX - 0.85, rayY - 0.52, rayZ - 0.0002);
    },);

    loaderLocation.load('./3d/models/avia_scene/remote/left2.glb', function (gltf) {
        let arrow1 = gltf.scene;
        gltf.scene.scale.set(0.5, 0.5, 0.5);
        scene.add(arrow1);
        groupRemote.add(arrow1);
        camera.add(arrow1);
        arrow1.rotateX(Math.PI / 2);
        arrow1.rotateY(Math.PI / 2);
        arrow1.position.set(rayX - 0.85, rayY - 0.52, rayZ - 0.0002);
    },);

    loaderLocation.load('./3d/models/avia_scene/remote/right2.glb', function (gltf) {
        let arrow1 = gltf.scene;
        gltf.scene.scale.set(0.5, 0.5, 0.5);
        scene.add(arrow1);
        groupRemote.add(arrow1);
        camera.add(arrow1);
        arrow1.rotateX(Math.PI / 2);
        arrow1.rotateY(Math.PI / 2);
        arrow1.position.set(rayX - 0.85, rayY - 0.52, rayZ - 0.0002);
    },);
    //
    //
    loaderLocation.load('./3d/models/avia_scene/remote/carcas.glb', function (gltf) {
        let carcas = gltf.scene;
        gltf.scene.scale.set(0.5, 0.5, 0.5);
        scene.add(carcas);
        groupRemote.add(carcas);
        camera.add(carcas);
        carcas.rotateX(Math.PI / 2);
        carcas.rotateY(Math.PI / 2);
        carcas.position.set(rayX - 0.85, rayY - 0.52, rayZ - 0.0002);
    },);

    loaderLocation.load('./3d/models/avia_scene/remote/leftstick.glb', function (gltf) {
        let carcas = gltf.scene;
        gltf.scene.scale.set(0.5, 0.5, 0.5);
        scene.add(carcas);
        groupRemote.add(carcas);
        camera.add(carcas);
        carcas.rotateX(Math.PI / 2);
        carcas.rotateY(Math.PI / 2);
        carcas.position.set(rayX - 0.85, rayY - 0.52, rayZ - 0.0002);
    },);

    loaderLocation.load('./3d/models/avia_scene/remote/rightstick.glb', function (gltf) {
        let carcas = gltf.scene;
        gltf.scene.scale.set(0.5, 0.5, 0.5);
        scene.add(carcas);
        groupRemote.add(carcas);
        camera.add(carcas);
        carcas.rotateX(Math.PI / 2);
        carcas.rotateY(Math.PI / 2);
        carcas.position.set(rayX - 0.85, rayY - 0.52, rayZ - 0.0002);
    },);
    //
    //
    loaderLocation.load('./3d/models/avia_scene/remote/up1.glb', function (gltf) {
        let arrow1 = gltf.scene;
        gltf.scene.scale.set(0.5, 0.5, 0.5);
        scene.add(arrow1);
        groupRemote.add(arrow1);
        camera.add(arrow1);
        arrow1.rotateX(Math.PI / 2);
        arrow1.rotateY(Math.PI / 2);
        arrow1.position.set(rayX - 0.85, rayY - 0.52, rayZ - 0.0002);
    },);

    loaderLocation.load('./3d/models/avia_scene/remote/down1.glb', function (gltf) {
        let arrow1 = gltf.scene;
        gltf.scene.scale.set(0.5, 0.5, 0.5);
        scene.add(arrow1);
        groupRemote.add(arrow1);
        camera.add(arrow1);
        arrow1.rotateX(Math.PI / 2);
        arrow1.rotateY(Math.PI / 2);
        arrow1.position.set(rayX - 0.85, rayY - 0.52, rayZ - 0.0002);
    },);

    loaderLocation.load('./3d/models/avia_scene/remote/left1.glb', function (gltf) {
        let arrow1 = gltf.scene;
        gltf.scene.scale.set(0.5, 0.5, 0.5);
        scene.add(arrow1);
        groupRemote.add(arrow1);
        camera.add(arrow1);
        arrow1.rotateX(Math.PI / 2);
        arrow1.rotateY(Math.PI / 2);
        arrow1.position.set(rayX - 0.85, rayY - 0.52, rayZ - 0.0002);
    },);

    loaderLocation.load('./3d/models/avia_scene/remote/right1.glb', function (gltf) {
        let arrow1 = gltf.scene;
        gltf.scene.scale.set(0.5, 0.5, 0.5);
        scene.add(arrow1);
        groupRemote.add(arrow1);
        camera.add(arrow1);
        arrow1.rotateX(Math.PI / 2);
        arrow1.rotateY(Math.PI / 2);
        arrow1.position.set(rayX - 0.85, rayY - 0.52, rayZ - 0.0002);
    },);


    let changeTestOn = function (event) {
        switch (event.keyCode) {
            case 87: // w
                chaingeColor1ArUp();
                break;
            case 83: // s
                chaingeColor1ArDown();
                break;
            case 65: // a
                chaingeColor1ArLeft();
                break;
            case 68: // d
                chaingeColor1ArRight();
                break;

            case 32: // space
                chaingeColor1Up();
                break;
            case 67: // c
                chaingeColor1Down();
                break;
            case 88: // x
                chaingeColor1Down();
                break;

            case 69: // e
                chaingeColor1RightRotate();
                break;
            case 81: // q
                chaingeColor1LeftRotate();
                break;
        }
    };
    document.addEventListener('keydown', changeTestOn, false);

    let changeTestoff = function (event) {
        switch (event.keyCode) {
            case 87: // w
                chaingeColor2ArUp();
                break;
            case 83: // s
                chaingeColor2ArDown();
                break;
            case 65: // a
                chaingeColor2ArLeft();
                break;
            case 68: // d
                chaingeColor2ArRight();
                break;

            case 32: // space
                chaingeColor2Up();
                break;
            case 67: // c
                chaingeColor2Down();
                break;
            case 88: // x
                chaingeColor2Down();
                break;
            case 69: // e
                chaingeColor2ArRightRotate();
                break;
            case 81: // q
                chaingeColor2ArLeftRotate();
                break;
            case 71: // g
                startTest();
                break;
            case 84: // t
                startTraining();
                break;

        }
    };
    document.addEventListener('keyup', changeTestoff, false);


    function changeBatteryCharge(value) {
        const batteryMark = document.getElementById('battery-mark');
        const batteryColorTube = document.getElementById('battery-color-tube');
        batteryMark.innerText = value;
    }

    function startTest() {
        pointCount = 0;
        const messageAboutTest = document.querySelector('.message-wrapper');
        const timeCounterWrapper = document.querySelector('.time-counter-wrapper');

        messageAboutTest.innerHTML = 'Внимание! <br> В процессе прохождения теста вам надо будет показать своё мастерство управления дроном.<br>\n' +
            '        Необходимо собрать как можно больше деталей за одну минуту.<br>\n' +
            '        Если вы готовы пройти тест, нажмите клавишу "G".<br>\n' +
            '        Или нажмите "T" для тренировки.';

        changeBatteryCharge(60);

        messageAboutTest.setAttribute('style', 'display: none;');
        timeCounterWrapper.innerHTML = '60';
        let counter = 60;
        let testTime = setInterval(function () {
            counter -= 1;
            timeCounterWrapper.innerHTML = counter;
            changeBatteryCharge(counter);
        }, 1000);
        setTimeout(() => {
            clearInterval(testTime);
            stopTest();
        }, 60000);

    }

    function stopTest() {
        const messageAboutTest = document.querySelector('.message-wrapper');
        messageAboutTest.innerHTML = 'Тест завершён. Вы набрали ' + pointCount + ' очков.'
        messageAboutTest.setAttribute('style', 'display: block;t')
        pointCount = 0;
        changeBatteryCharge(60);
    }

    function startTraining() {
        const messageAboutTest = document.querySelector('.message-wrapper');
        const timeCounterWrapper = document.querySelector('.time-counter-wrapper');
        const pointCounterWrapper = document.querySelector('.point-counter-wrapper');
        messageAboutTest.setAttribute('style', 'display: none;');
        timeCounterWrapper.setAttribute('style', 'display: none;');
        pointCounterWrapper.setAttribute('style', 'display: none;');
    }

    // правый стик
    //
    function chaingeColor1ArUp() { // вверх стрелка
        let colorRemoteOn = new THREE.MeshLambertMaterial({color: '#f00'});
        camera.children[2].children[0].material = colorRemoteOn;
    }

    function chaingeColor2ArUp() { // вверх стрелка
        let colorRemoteOn = new THREE.MeshLambertMaterial({color: 'grey'})
        camera.children[2].children[0].material = colorRemoteOn;
    }


    function chaingeColor1ArDown() { // вверх стрелка
        let colorRemoteOn = new THREE.MeshLambertMaterial({color: '#f00'});
        camera.children[3].children[0].material = colorRemoteOn;
    }

    function chaingeColor2ArDown() { // вверх стрелка
        let colorRemoteOn = new THREE.MeshLambertMaterial({color: 'grey'})
        camera.children[3].children[0].material = colorRemoteOn;
    }


    function chaingeColor1ArLeft() { // вверх стрелка
        let colorRemoteOn = new THREE.MeshLambertMaterial({color: '#f00'});
        camera.children[4].children[0].material = colorRemoteOn;
    }

    function chaingeColor2ArLeft() { // вверх стрелка
        let colorRemoteOn = new THREE.MeshLambertMaterial({color: 'grey'})
        camera.children[4].children[0].material = colorRemoteOn;
    }


    function chaingeColor1ArRight() { // вверх стрелка
        let colorRemoteOn = new THREE.MeshLambertMaterial({color: '#f00'});
        camera.children[5].children[0].material = colorRemoteOn;
    }

    function chaingeColor2ArRight() { // вверх стрелка
        let colorRemoteOn = new THREE.MeshLambertMaterial({color: 'grey'})
        camera.children[5].children[0].material = colorRemoteOn;
    }

    //
    // левый стик
    //

    function chaingeColor1Up() { // вверх стрелка
        let colorRemoteOn = new THREE.MeshLambertMaterial({color: '#f00'});
        camera.children[9].children[0].material = colorRemoteOn;
    }

    function chaingeColor2Up() { // вверх стрелка
        let colorRemoteOn = new THREE.MeshLambertMaterial({color: 'grey'})
        camera.children[9].children[0].material = colorRemoteOn;
    }

    function chaingeColor1Down() { // вверх стрелка
        let colorRemoteOn = new THREE.MeshLambertMaterial({color: '#f00'});
        camera.children[10].children[0].material = colorRemoteOn;
    }

    function chaingeColor2Down() { // вверх стрелка
        let colorRemoteOn = new THREE.MeshLambertMaterial({color: 'grey'})
        camera.children[10].children[0].material = colorRemoteOn;
    }


    function chaingeColor1RightRotate() { // вверх стрелка
        let colorRemoteOn = new THREE.MeshLambertMaterial({color: '#f00'});
        camera.children[11].children[0].material = colorRemoteOn;
    }

    function chaingeColor2ArRightRotate() { // вверх стрелка
        let colorRemoteOn = new THREE.MeshLambertMaterial({color: 'grey'})
        camera.children[11].children[0].material = colorRemoteOn;
    }

    function chaingeColor1LeftRotate() { // вверх стрелка
        let colorRemoteOn = new THREE.MeshLambertMaterial({color: '#f00'});
        camera.children[12].children[0].material = colorRemoteOn;
    }

    function chaingeColor2ArLeftRotate() { // вверх стрелка
        let colorRemoteOn = new THREE.MeshLambertMaterial({color: 'grey'})
        camera.children[12].children[0].material = colorRemoteOn;
    }


    /*
        function movinCheck() { //
            let colorRemoteOff = new THREE.MeshPhongMaterial({color: "black", depthWrite: false});
            let colorRemoteOn = new THREE.MeshPhongMaterial({color: "red", depthWrite: false});

                if (keyStates['KeyW'] == true) {
                    groupRemote.children[0].children[0].material = colorRemoteOn;
                }
                if (keyStates['KeyW'] == false){
                    groupRemote.children[0].children[0].material = colorRemoteOff;
                }
            }
    */


    /*
    // загрузка анимационных моделей: --------------------------------------------------------
        // model
        var loader = new FBXLoader();
        // загрузка моделей:
        let ob12 = './3d/models/arenanimat/01 1кол.fbx'; // лого 0,3  и 1,0
    //	fun3d(ob12, 0,3, 1, 0,0,0,); // -3д модель, child , clip в миксер анимации, scaleObj , positions x-y-z
        // сначала имя модели, затем размер, далее ребенок объекта, далее клип анимации
        function fun3d(obs, objChil, objClip, scaleObj, xObj, yObj, zObj) { // моя фун. для удобства быстрой щагрузки в аргументы параметров
            loader.load(obs, function (object) {	// встроенный метод загрузки моделей

                var mesh = object.children[objChil]; // меш как child - подобъект файла анимации
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                scene.add(mesh);

                mixer = new THREE.AnimationMixer(object);
                var action = mixer.clipAction(object.animations[objClip]);   // загрузка клипа анимации
                object.position.set(xObj, yObj, zObj); // перемещение именно аним объекта, а не просто mesh.position.set(0,0,0); // как child
                object.scale.set(scaleObj, scaleObj, scaleObj); // масштабир-е именно аним об, а не  mesh.scale.set(0,0,0); // как child
                object.castShadow = true; // отброс теней именно от аним объекта,  а не mesh
                object.receiveShadow = true;

                action.play();
                scene.add(object);
            });
        }
    */

    // cleaners scene:
    function Remove() {
        while (scene.children.length > 0) {
            scene.remove(scene.children[0]);
        }
    }

    // функция очистки сцены для fbx
    function remov3d() {
        scene.remove(object), scene.remove(object.scene), scene.remove(mesh), scene.remove(mixer),
            geometry.dispose(), mesh.dispose(), action.dispose(), scene.dispose(), action.stop(), texture.dispose();
    }

    function delCtrols() {
        scene.remove(control), scene.remove(controls.scene), scene.remove(orbit), scene.remove(controls);
    }


// Физика:------------------------------------------------------------
    // к выстрелу шарами: ------
    const NUM_SPHERES = 20;
    const SPHERE_RADIUS = 0.2;
    const sphereGeometry = new THREE.SphereBufferGeometry(SPHERE_RADIUS, 32, 32);
    const sphereMaterial = new THREE.MeshStandardMaterial({color: 0x468B4, roughness: 0.8, metalness: 0.5});
    const spheres = []; // массив для сфер, кот. были выстрелами
    let sphereIdx = 0;
    for (let i = 0; i < NUM_SPHERES; i++) {
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        scene.add(sphere);
        spheres.push({
            mesh: sphere,
            collider: new THREE.Sphere(new THREE.Vector3(0, -100, 0), SPHERE_RADIUS),
            velocity: new THREE.Vector3()
        });
    }

    //


    function playerCollitions() { // столкновения игрока
        const result = worldOctree.capsuleIntersect(playerCollider); // резул того как капсула пересеклась с телом мира
        playerOnFloor = false;

        if (result) {
            playerOnFloor = result.normal.y > 0; // если столкновение по нормалю больше 0
            if (!playerOnFloor) {
                playerVelocity.addScaledVector(result.normal, -result.normal.dot(playerVelocity)); // передаем в вектор3 скорости по методу рез отскока
            }
            playerCollider.translate(result.normal.multiplyScalar(result.depth));
        }
    }


    function updatePlayer(deltaTime) { //ф-я передана в анимацию о его нач скорости и собитии с клавиатуры
        if (playerOnFloor) { // если игрок на сцене, то будут улавливаться события клав-ры
            //	let damping = Math.exp( - 150 * deltaTime ) - 1;
            //	playerVelocity.addScaledVector( playerVelocity, damping );
            playerVelocity.addScaledVector(playerVelocity, -0.4);
        } else {
            playerVelocity.y -= gravity * deltaTime; // вертик. скорость = притяжение к сезмле* на затрчаенное время на перисовку рез-та функции
        }
        const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);// позиция из скорости и суммы установленных сек, что в аргументе
        playerCollider.translate(deltaPosition); // передаем в коллизию игрока ту позицию, что сложилась после его скорости и суммы установ. времени
        playerCollitions(); // вызов проверки столкновения игрока
        camera.position.copy(playerCollider.end); // камера берется из позиции капуслы игрока
    }


    function spheresCollisions() { // столкновения для сферы
        for (let i = 0; i < spheres.length; i++) {
            const s1 = spheres[i]; // все выстрелы, что сделались остаются насцене и при столкновении отскакивают исходя из своих размеров радиуса , нормаля и скорости
            for (let j = i + 1; j < spheres.length; j++) {
                const s2 = spheres[j];
                const d2 = s1.collider.center.distanceToSquared(s2.collider.center);
                const r = s1.collider.radius + s2.collider.radius;
                const r2 = r * r;

                if (d2 < r2) {
                    const normal = s1.collider.clone().center.sub(s2.collider.center).normalize();
                    const v1 = normal.clone().multiplyScalar(normal.dot(s1.velocity));
                    const v2 = normal.clone().multiplyScalar(normal.dot(s2.velocity));
                    s1.velocity.add(v2).sub(v1);
                    s2.velocity.add(v1).sub(v2);

                    const d = (r - Math.sqrt(d2)) / 2;
                    s1.collider.center.addScaledVector(normal, d);
                    s2.collider.center.addScaledVector(normal, -d);
                }
            }
        }
    }

    function updateSpheres(deltaTime) { // фун-я перед-ся в анимацию для перерисовки по кадрам
        spheres.forEach(sphere => {
            sphere.collider.center.addScaledVector(sphere.velocity, deltaTime);
            const result = worldOctree.sphereIntersect(sphere.collider);
            if (result) {
                sphere.velocity.addScaledVector(result.normal, -result.normal.dot(sphere.velocity) * 1.5);
                sphere.collider.center.add(result.normal.multiplyScalar(result.depth));
            } else {
                sphere.velocity.y -= gravity * deltaTime;
            }
            const damping = Math.exp(-1.5 * deltaTime) - 1;
            sphere.velocity.addScaledVector(sphere.velocity, damping);
            spheresCollisions(); // столкновения для сферы тоже проигрывается в анимации
            sphere.mesh.position.copy(sphere.collider.center);
        });
    }


// Перерисовка и анимация кадров: ------------------------------
    animate();

    function animate() { // анимация - перерисовка функций по установленному времени сколько раз в сек.
        const deltaTime = Math.min(0.1, clock.getDelta());
        updatePlayer(deltaTime);
        updateSpheres(deltaTime);
        renderer.render(scene, camera);
        requestAnimationFrame(animate);

        movingfunction(deltaTime);
        movingfunctionAir(deltaTime);

        moveSaltoRight(deltaTime);
        moveSaltoLeft(deltaTime);

        requestAnimationFrame(touchRedButton);
        //   accelPrint(deltaTime);
        //   movinCheck();

        moveshift(deltaTime);
        moveshiftonAir(deltaTime);

        var delta = clock.getDelta();
        if (mixer) mixer.update(delta);
        for (var i = 0; i < mixers.length; i++) {
            mixers[i].update(delta);
        }
    }


}






				
