// Archivo de prueba para verificar la importación de Firebase
import { db } from '../config/firebase';
import { collection, doc } from 'firebase/firestore';

console.log('Firebase import test:', !!db);

export { db };
