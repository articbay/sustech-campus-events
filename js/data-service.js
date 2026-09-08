import { supabase } from './supabase-client.js';

function assertNoError(error) {
    if (error) throw error;
}

export async function listEvents() {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_time', { ascending: true });
    assertNoError(error);
    return data ?? [];
}

export async function getSessionUser() {
    const { data, error } = await supabase.auth.getSession();
    assertNoError(error);
    return data.session?.user ?? null;
}

export async function getOwnProfile(userId) {
    if (!userId) return null;
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    assertNoError(error);
    return data;
}

export async function getOwnRegistrationIds(userId) {
    if (!userId) return [];
    const { data, error } = await supabase
        .from('registrations')
        .select('event_id')
        .eq('user_id', userId);
    assertNoError(error);
    return (data ?? []).map(row => row.event_id);
}

export async function signUp({ fullName, studentEmployeeId, email, password }) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                student_employee_id: studentEmployeeId
            }
        }
    });
    assertNoError(error);
    return data;
}

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    assertNoError(error);
    return data;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    assertNoError(error);
}

export function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((_event, session) => {
        window.setTimeout(() => callback(session?.user ?? null), 0);
    });
}

export async function createEvent(event, userId, organizerName) {
    const { data, error } = await supabase
        .from('events')
        .insert({
            ...event,
            organizer_id: userId,
            organizer_name: organizerName,
            source: 'user'
        })
        .select()
        .single();
    assertNoError(error);
    return data;
}

export async function updateEvent(eventId, event) {
    const { data, error } = await supabase
        .from('events')
        .update(event)
        .eq('id', eventId)
        .select()
        .single();
    assertNoError(error);
    return data;
}

export async function removeEvent(eventId) {
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    assertNoError(error);
}

export async function registerForEvent(eventId) {
    const { error } = await supabase.rpc('register_for_event', { p_event_id: eventId });
    assertNoError(error);
}

export async function cancelEventRegistration(eventId) {
    const { error } = await supabase.rpc('cancel_event_registration', { p_event_id: eventId });
    assertNoError(error);
}
