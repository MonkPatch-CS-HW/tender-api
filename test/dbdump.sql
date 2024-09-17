--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4 (Debian 16.4-1.pgdg120+1)
-- Dumped by pg_dump version 16.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: bid_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.bid_status AS ENUM (
    'Created',
    'Published',
    'Canceled'
);


ALTER TYPE public.bid_status OWNER TO postgres;

--
-- Name: bud_author_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.bud_author_type AS ENUM (
    'Organization',
    'User'
);


ALTER TYPE public.bud_author_type OWNER TO postgres;

--
-- Name: organization_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.organization_type AS ENUM (
    'IE',
    'LLC',
    'JSC'
);


ALTER TYPE public.organization_type OWNER TO postgres;

--
-- Name: tender_service_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tender_service_type AS ENUM (
    'Construction',
    'Delivery',
    'Manufacture'
);


ALTER TYPE public.tender_service_type OWNER TO postgres;

--
-- Name: tender_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tender_status AS ENUM (
    'Created',
    'Published',
    'Canceled'
);


ALTER TYPE public.tender_status OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bid; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bid (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    status public.bid_status DEFAULT 'Created'::public.bid_status NOT NULL,
    tender_id uuid NOT NULL,
    author_type public.bud_author_type NOT NULL,
    author_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    original_id uuid,
    "organizationId" uuid,
    creator_id uuid NOT NULL
);


ALTER TABLE public.bid OWNER TO postgres;

--
-- Name: employee; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(50) NOT NULL,
    first_name character varying(50),
    last_name character varying(50),
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.employee OWNER TO postgres;

--
-- Name: feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feedback (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    creator_id uuid NOT NULL,
    bid_id uuid NOT NULL,
    message text NOT NULL,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.feedback OWNER TO postgres;

--
-- Name: organization; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    type public.organization_type,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.organization OWNER TO postgres;

--
-- Name: organization_responsible; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_responsible (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    user_id uuid
);


ALTER TABLE public.organization_responsible OWNER TO postgres;

--
-- Name: tender; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tender (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    service_type public.tender_service_type NOT NULL,
    status public.tender_status DEFAULT 'Created'::public.tender_status NOT NULL,
    organization_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    creator_id uuid NOT NULL,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    original_id uuid
);


ALTER TABLE public.tender OWNER TO postgres;

--
-- Data for Name: bid; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bid (id, name, description, status, tender_id, author_type, author_id, version, created_at, updated_at, original_id, "organizationId", creator_id) FROM stdin;
\.


--
-- Data for Name: employee; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employee (id, username, first_name, last_name, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.feedback (id, creator_id, bid_id, message, created_at) FROM stdin;
\.


--
-- Data for Name: organization; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization (id, name, description, type, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: organization_responsible; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_responsible (id, organization_id, user_id) FROM stdin;
\.


--
-- Data for Name: tender; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tender (id, name, description, service_type, status, organization_id, version, creator_id, created_at, updated_at, original_id) FROM stdin;
\.


--
-- Name: bid bid_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bid
    ADD CONSTRAINT bid_pkey PRIMARY KEY (id);


--
-- Name: employee employee_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: organization_responsible organization_responsible_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_responsible
    ADD CONSTRAINT organization_responsible_pkey PRIMARY KEY (id);


--
-- Name: tender tender_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender
    ADD CONSTRAINT tender_pkey PRIMARY KEY (id);


--
-- Name: bid_original_id_version_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX bid_original_id_version_key ON public.bid USING btree (original_id, version);


--
-- Name: employee_username_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX employee_username_key ON public.employee USING btree (username);


--
-- Name: tender_original_id_version_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX tender_original_id_version_key ON public.tender USING btree (original_id, version);


--
-- Name: bid bid_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bid
    ADD CONSTRAINT bid_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.employee(id) ON DELETE CASCADE;


--
-- Name: bid bid_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bid
    ADD CONSTRAINT "bid_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organization(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: bid bid_tender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bid
    ADD CONSTRAINT bid_tender_id_fkey FOREIGN KEY (tender_id) REFERENCES public.tender(id) ON DELETE CASCADE;


--
-- Name: feedback feedback_bid_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_bid_id_fkey FOREIGN KEY (bid_id) REFERENCES public.bid(id) ON DELETE CASCADE;


--
-- Name: feedback feedback_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.employee(id) ON DELETE CASCADE;


--
-- Name: organization_responsible organization_responsible_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_responsible
    ADD CONSTRAINT organization_responsible_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: organization_responsible organization_responsible_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_responsible
    ADD CONSTRAINT organization_responsible_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.employee(id) ON DELETE CASCADE;


--
-- Name: tender tender_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender
    ADD CONSTRAINT tender_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.employee(id) ON DELETE CASCADE;


--
-- Name: tender tender_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tender
    ADD CONSTRAINT tender_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

